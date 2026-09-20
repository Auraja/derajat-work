from collections import OrderedDict, deque
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.auth import routes as auth_routes
from app.core.config import Settings


def test_trusted_proxy_configuration_rejects_invalid_networks():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, trusted_proxy_cidrs=["not-a-network"])


def test_me_requires_authentication(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_login_throttles_repeated_failures(client):
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "wrong-password"},
    )

    assert blocked.status_code == 429


def test_login_throttle_rejects_a_correct_password(client):
    for _ in range(auth_routes._LOGIN_MAX_FAILURES):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )

    assert response.status_code == 429


def test_login_throttle_rejects_before_password_verification(client, monkeypatch):
    for _ in range(auth_routes._LOGIN_MAX_FAILURES):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    def fail_verification(_: str, __: str) -> bool:
        raise AssertionError("password verification must not run for a throttled request")

    monkeypatch.setattr(auth_routes, "verify_password", fail_verification)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )

    assert response.status_code == 429


def test_login_throttle_does_not_block_other_accounts(app, client):
    for _ in range(5):
        client.post(
            "/api/v1/auth/login",
            json={"email": "unknown@example.com", "password": "wrong-password"},
        )

    with TestClient(app, client=("198.51.100.24", 4123)) as other_source:
        response = other_source.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "correct horse battery staple"},
        )

    assert response.status_code == 200


def test_login_throttle_does_not_allow_one_source_to_lock_another_source(app, client):
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    with TestClient(app, client=("198.51.100.24", 4123)) as other_source:
        response = other_source.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "correct horse battery staple"},
        )

    assert response.status_code == 200


def test_login_throttle_limits_distributed_failures_against_one_account(app, client):
    for source_index in range(3):
        with TestClient(app, client=(f"198.51.100.{source_index + 1}", 4123)) as source:
            for _ in range(4):
                response = source.post(
                    "/api/v1/auth/login",
                    json={"email": "admin@example.com", "password": "wrong-password"},
                )
                assert response.status_code == 401

    with TestClient(app, client=("198.51.100.99", 4123)) as next_source:
        blocked = next_source.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )

    assert blocked.status_code == 429


def test_login_throttle_ignores_forwarded_client_ip_from_untrusted_peer(client):
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            headers={"CF-Connecting-IP": "198.51.100.10"},
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    response = client.post(
        "/api/v1/auth/login",
        headers={"CF-Connecting-IP": "198.51.100.11"},
        json={"email": "other@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 429


def test_login_throttle_uses_cloudflare_ip_from_the_exact_trusted_proxy(app, client):
    app.state.settings.trusted_proxy_cidrs = ["172.23.0.3/32"]
    with TestClient(app, client=("172.23.0.3", 4123)) as proxied_client:
        for _ in range(5):
            response = proxied_client.post(
                "/api/v1/auth/login",
                headers={"CF-Connecting-IP": "198.51.100.10"},
                json={"email": "admin@example.com", "password": "wrong-password"},
            )
            assert response.status_code == 401

        response = proxied_client.post(
            "/api/v1/auth/login",
            headers={"CF-Connecting-IP": "198.51.100.11"},
            json={"email": "admin@example.com", "password": "correct horse battery staple"},
        )

    assert response.status_code == 200


def test_pair_throttle_tracks_new_keys_while_remaining_bounded(app):
    request = SimpleNamespace(app=app)
    for index in range(auth_routes._LOGIN_MAX_KEYS):
        failures = auth_routes._failed_attempts(
            request, (f"source-{index}", f"decoy-{index}@example.com")
        )
        assert failures is not None
        failures.append(auth_routes.monotonic())

    oldest_key = ("source-0", "decoy-0@example.com")
    overflow = auth_routes._failed_attempts(request, ("overflow-source", "overflow@example.com"))

    assert overflow is not None
    assert len(overflow) == 0
    assert oldest_key not in app.state.login_failed_attempts
    assert ("overflow-source", "overflow@example.com") in app.state.login_failed_attempts
    assert len(app.state.login_failed_attempts) == auth_routes._LOGIN_MAX_KEYS


def test_saturated_throttle_stores_do_not_globally_block_valid_login(app, client):
    failed_at = auth_routes.monotonic()
    app.state.login_source_failed_attempts = OrderedDict(
        (f"source-{index}", deque([failed_at]))
        for index in range(auth_routes._LOGIN_MAX_KEYS)
    )
    app.state.login_account_failed_attempts = OrderedDict(
        (f"decoy-{index}@example.com", deque([failed_at]))
        for index in range(auth_routes._LOGIN_MAX_KEYS)
    )
    app.state.login_failed_attempts = OrderedDict(
        ((f"source-{index}", f"decoy-{index}@example.com"), deque([failed_at]))
        for index in range(auth_routes._LOGIN_MAX_KEYS)
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )

    assert response.status_code == 200


def test_saturated_stores_still_throttle_a_known_account(app, client, monkeypatch):
    sources = iter(f"198.51.100.{index}" for index in range(1, 256))
    monkeypatch.setattr(auth_routes, "_login_source", lambda _: next(sources))
    monkeypatch.setattr(auth_routes, "verify_password", lambda *_: False)

    for index in range(auth_routes._LOGIN_MAX_KEYS):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": f"decoy-{index}@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    for _ in range(auth_routes._LOGIN_ACCOUNT_MAX_FAILURES):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "wrong-password"},
    )

    assert blocked.status_code == 429


def test_login_throttle_state_is_bounded(client, app, monkeypatch):
    sources = iter(f"198.51.100.{index}" for index in range(140))
    monkeypatch.setattr(auth_routes, "_login_source", lambda _: next(sources))
    monkeypatch.setattr(auth_routes, "verify_password", lambda *_: False)
    for index in range(140):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": f"unknown-{index}@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    assert len(app.state.login_failed_attempts) <= 128
    assert len(getattr(app.state, "login_account_failed_attempts", {})) <= 128
    assert len(app.state.login_source_failed_attempts) <= 128


def test_login_throttle_discards_expired_keys(client, app, monkeypatch):
    now = 1_000.0
    monkeypatch.setattr(auth_routes, "monotonic", lambda: now)
    client.post(
        "/api/v1/auth/login",
        json={"email": "first@example.com", "password": "wrong-password"},
    )

    now += auth_routes._LOGIN_WINDOW_SECONDS + 1
    client.post(
        "/api/v1/auth/login",
        json={"email": "second@example.com", "password": "wrong-password"},
    )

    assert list(app.state.login_failed_attempts) == [("testclient", "second@example.com")]


def test_login_sets_http_only_cookie_and_me_returns_user(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ADMIN@example.com", "password": "correct horse battery staple"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "admin@example.com"
    cookie = response.headers["set-cookie"]
    assert "derajat_session=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Test Admin"


def test_login_rejects_invalid_credentials_without_disclosure(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "totally-wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_runs_password_verification_for_known_and_unknown_emails(client, monkeypatch):
    verified_hashes: list[str] = []

    def record_verification(_: str, password_hash: str) -> bool:
        verified_hashes.append(password_hash)
        return False

    monkeypatch.setattr(auth_routes, "verify_password", record_verification)

    known = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "wrong-password"},
    )
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong-password"},
    )

    assert known.status_code == unknown.status_code == 401
    assert len(verified_hashes) == 2


def test_logout_clears_cookie_and_session(client):
    client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"message": "Logged out"}
    assert 'derajat_session=""' in response.headers["set-cookie"]
    assert client.get("/api/v1/auth/me").status_code == 401


def test_profile_can_be_updated(auth_client):
    response = auth_client.patch(
        "/api/v1/users/me",
        json={"name": "Updated Admin", "email": "new-admin@example.com"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Updated Admin"
    assert response.json()["email"] == "new-admin@example.com"


def test_password_change_invalidates_previous_token(client, app):
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "correct horse battery staple"},
    )
    old_token = login.cookies["derajat_session"]

    changed = client.patch(
        "/api/v1/users/me/password",
        json={
            "current_password": "correct horse battery staple",
            "new_password": "an even better password",
        },
    )
    assert changed.status_code == 200
    assert changed.json() == {"message": "Password changed. Please log in again."}

    with TestClient(app) as old_client:
        old_client.cookies.set("derajat_session", old_token)
        assert old_client.get("/api/v1/auth/me").status_code == 401

    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "correct horse battery staple"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "an even better password"},
        ).status_code
        == 200
    )


def test_password_change_requires_correct_password(auth_client):
    response = auth_client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "wrong-current", "new_password": "long enough replacement"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect"


def test_password_fields_require_eight_characters(client, auth_client):
    short_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "short"},
    )
    short_change = auth_client.patch(
        "/api/v1/users/me/password",
        json={"current_password": "correct horse battery staple", "new_password": "short"},
    )

    assert short_login.status_code == 422
    assert short_change.status_code == 422
