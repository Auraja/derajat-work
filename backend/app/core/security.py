from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(
    *, user_id: int, password_version: int, secret_key: str, expires_minutes: int
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "ver": password_version,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")


def decode_access_token(token: str, secret_key: str) -> dict[str, Any]:
    return jwt.decode(token, secret_key, algorithms=["HS256"])
