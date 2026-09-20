import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.models import User
from app.services.users import change_user_password, normalize_email, provision_admin


def _required_value(value: str | None, prompt: str) -> str:
    result = value.strip() if value is not None else input(prompt).strip()
    if not result:
        raise ValueError(f"{prompt.rstrip(': ')} is required")
    return result


def _password() -> str:
    password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Password: ")
    if len(password) < 8:
        raise ValueError("Password must contain at least 8 characters")
    return password


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create-admin", help="Provision the administrator")
    create.add_argument("--email", help="Admin email; prompts when omitted")
    create.add_argument("--name", help="Admin display name; prompts when omitted")

    change = commands.add_parser("change-password", help="Change a user password")
    change.add_argument("--email", help="Account email; prompts when omitted")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        email = _required_value(args.email, "Email: ")
        password = _password()
        settings = get_settings()
        engine = build_engine(settings.database_url)
        session_factory = build_session_factory(engine)
        try:
            with session_factory() as session:
                if args.command == "create-admin":
                    name = _required_value(args.name, "Name: ")
                    user = provision_admin(session, email=email, password=password, name=name)
                    print(f"Administrator ready: {user.email}")
                else:
                    normalized = normalize_email(email)
                    user = session.scalar(select(User).where(User.email == normalized))
                    if user is None:
                        raise ValueError("User not found")
                    change_user_password(session, user, password)
                    print(f"Password changed: {user.email}")
        finally:
            engine.dispose()
    except (EOFError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
