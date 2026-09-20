from collections import OrderedDict, deque
from ipaddress import ip_address, ip_network
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, Message
from app.schemas.users import UserRead
from app.services.activity import log_activity
from app.services.users import normalize_email

router = APIRouter(prefix="/auth", tags=["auth"])
_LOGIN_WINDOW_SECONDS = 300
_LOGIN_MAX_FAILURES = 5
_LOGIN_ACCOUNT_MAX_FAILURES = 12
_LOGIN_MAX_KEYS = 128
_login_attempts_lock = Lock()
_DUMMY_PASSWORD_HASH = hash_password("dummy-password-used-only-for-timing-equality")


def _login_source(request: Request) -> str:
    peer = request.client.host if request.client is not None else "unknown"
    try:
        peer_address = ip_address(peer)
    except ValueError:
        return peer

    trusted_proxy_cidrs = request.app.state.settings.trusted_proxy_cidrs
    if not any(peer_address in ip_network(cidr) for cidr in trusted_proxy_cidrs):
        return peer

    cloudflare_address = request.headers.get("CF-Connecting-IP")
    if cloudflare_address:
        try:
            return str(ip_address(cloudflare_address.strip()))
        except ValueError:
            pass
    return peer


def _account_failed_attempts(request: Request, account_id: int) -> deque[float]:
    attempts = getattr(request.app.state, "login_account_failed_attempts", None)
    if attempts is None:
        attempts = OrderedDict()
        request.app.state.login_account_failed_attempts = attempts
    cutoff = monotonic() - _LOGIN_WINDOW_SECONDS
    for stored_account_id, stored_failures in list(attempts.items()):
        while stored_failures and stored_failures[0] < cutoff:
            stored_failures.popleft()
        if not stored_failures:
            attempts.pop(stored_account_id, None)
    failures = attempts.get(account_id)
    if failures is None:
        failures = deque()
        attempts[account_id] = failures
    else:
        attempts.move_to_end(account_id)
    return failures


def _source_failed_attempts(request: Request, source: str) -> deque[float]:
    attempts = getattr(request.app.state, "login_source_failed_attempts", None)
    if attempts is None:
        attempts = OrderedDict()
        request.app.state.login_source_failed_attempts = attempts
    cutoff = monotonic() - _LOGIN_WINDOW_SECONDS
    for stored_source, stored_failures in list(attempts.items()):
        while stored_failures and stored_failures[0] < cutoff:
            stored_failures.popleft()
        if not stored_failures:
            attempts.pop(stored_source, None)
    failures = attempts.get(source)
    if failures is None:
        if len(attempts) >= _LOGIN_MAX_KEYS:
            attempts.popitem(last=False)
        failures = deque()
        attempts[source] = failures
    else:
        attempts.move_to_end(source)
    return failures


def _failed_attempts(request: Request, key: tuple[str, str]) -> deque[float]:
    attempts = getattr(request.app.state, "login_failed_attempts", None)
    if attempts is None:
        attempts = OrderedDict()
        request.app.state.login_failed_attempts = attempts
    cutoff = monotonic() - _LOGIN_WINDOW_SECONDS
    for stored_key, stored_failures in list(attempts.items()):
        while stored_failures and stored_failures[0] < cutoff:
            stored_failures.popleft()
        if not stored_failures:
            attempts.pop(stored_key, None)
    failures = attempts.get(key)
    if failures is None:
        if len(attempts) >= _LOGIN_MAX_KEYS:
            attempts.popitem(last=False)
        failures = deque()
        attempts[key] = failures
    else:
        attempts.move_to_end(key)
    return failures


def _login_failure_sets(
    request: Request, source: str, account_id: int | None, login_key: tuple[str, str]
) -> tuple[deque[float], deque[float] | None, deque[float]]:
    source_failures = _source_failed_attempts(request, source)
    account_failures = (
        _account_failed_attempts(request, account_id) if account_id is not None else None
    )
    account_source_failures = _failed_attempts(request, login_key)
    return source_failures, account_failures, account_source_failures


def _login_limit_reached(
    failure_sets: tuple[deque[float], deque[float] | None, deque[float]],
) -> bool:
    source_failures, account_failures, account_source_failures = failure_sets
    return (
        len(source_failures) >= _LOGIN_MAX_FAILURES
        or (
            account_failures is not None
            and len(account_failures) >= _LOGIN_ACCOUNT_MAX_FAILURES
        )
        or len(account_source_failures) >= _LOGIN_MAX_FAILURES
    )


def _login_throttle_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many login attempts; try again later",
        headers={"Retry-After": str(_LOGIN_WINDOW_SECONDS)},
    )


@router.post("/login", response_model=UserRead)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    session: Session = Depends(get_db),
) -> User:
    email = normalize_email(str(payload.email))
    source = _login_source(request)
    login_key = (source, email)
    user = session.scalar(select(User).where(User.email == email))
    account_id = user.id if user is not None else None

    with _login_attempts_lock:
        failure_sets = _login_failure_sets(request, source, account_id, login_key)
        if _login_limit_reached(failure_sets):
            raise _login_throttle_error()

    password_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
    password_valid = verify_password(payload.password, password_hash) and user is not None

    if not password_valid:
        with _login_attempts_lock:
            failure_sets = _login_failure_sets(request, source, account_id, login_key)
            if _login_limit_reached(failure_sets):
                raise _login_throttle_error()
            source_failures, account_failures, account_source_failures = failure_sets
            failed_at = monotonic()
            source_failures.append(failed_at)
            if account_failures is not None:
                account_failures.append(failed_at)
            account_source_failures.append(failed_at)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    assert user is not None
    with _login_attempts_lock:
        attempts = getattr(request.app.state, "login_failed_attempts", None)
        if attempts is not None:
            attempts.pop(login_key, None)
        account_attempts = getattr(request.app.state, "login_account_failed_attempts", None)
        if account_attempts is not None:
            account_attempts.pop(account_id, None)

    settings = request.app.state.settings
    token = create_access_token(
        user_id=user.id,
        password_version=user.password_version,
        secret_key=settings.secret_key.get_secret_value(),
        expires_minutes=settings.access_token_expire_minutes,
    )
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    log_activity(
        session, action="auth.login", user_id=user.id, entity_type="user", entity_id=user.id
    )
    session.commit()
    return user


@router.post("/logout", response_model=Message)
def logout(
    response: Response,
    request: Request,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> Message:
    settings = request.app.state.settings
    log_activity(
        session, action="auth.logout", user_id=user.id, entity_type="user", entity_id=user.id
    )
    session.commit()
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return Message(message="Logged out")


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)) -> User:
    return user
