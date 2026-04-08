from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.orm import Session, load_only
from sqlalchemy.orm.attributes import set_committed_value

from app.models.user import User
from app.services.platform import get_table_columns


def _user_columns(db: Session) -> set[str]:
    return get_table_columns(db, "users")


def find_user_by_email(db: Session, email: str) -> User | None:
    columns = _user_columns(db)
    required_columns = {"id", "full_name", "email", "hashed_password", "role"}
    if not required_columns.issubset(columns):
        return None

    selected_attributes = [
        User.id,
        User.full_name,
        User.email,
        User.hashed_password,
        User.role,
    ]
    if "is_active" in columns:
        selected_attributes.append(User.is_active)
    if "must_change_password" in columns:
        selected_attributes.append(User.must_change_password)

    user = db.scalar(select(User).options(load_only(*selected_attributes)).where(User.email == email))
    if user is None:
        return None

    if "is_active" not in columns:
        set_committed_value(user, "is_active", True)
    if "must_change_password" not in columns:
        set_committed_value(user, "must_change_password", False)
    return user


def create_user_compat(
    db: Session,
    *,
    full_name: str,
    email: str,
    hashed_password: str,
    role: str,
    is_active: bool = True,
    must_change_password: bool = False,
) -> User:
    columns = _user_columns(db)
    required_columns = {"full_name", "email", "hashed_password", "role"}
    if not required_columns.issubset(columns):
        raise RuntimeError("Users table is missing required columns")

    payload: dict[str, object] = {
        "full_name": full_name,
        "email": email,
        "hashed_password": hashed_password,
        "role": role,
    }
    if "is_active" in columns:
        payload["is_active"] = is_active
    if "must_change_password" in columns:
        payload["must_change_password"] = must_change_password

    column_names = ", ".join(payload.keys())
    bind_names = ", ".join(f":{key}" for key in payload)
    db.execute(text(f"INSERT INTO users ({column_names}) VALUES ({bind_names})"), payload)

    user = find_user_by_email(db, email)
    if user is None:
        raise RuntimeError("User insert was not persisted")
    return user


def set_user_password(
    db: Session,
    *,
    user: User,
    hashed_password: str,
    must_change_password: bool,
) -> None:
    columns = _user_columns(db)
    if "hashed_password" not in columns:
        raise RuntimeError("Users table is missing hashed_password")

    assignments = ["hashed_password = :hashed_password"]
    payload: dict[str, object] = {
        "user_id": user.id,
        "hashed_password": hashed_password,
    }
    if "must_change_password" in columns:
        assignments.append("must_change_password = :must_change_password")
        payload["must_change_password"] = must_change_password

    db.execute(
        text(f"UPDATE users SET {', '.join(assignments)} WHERE id = :user_id"),
        payload,
    )
    set_committed_value(user, "hashed_password", hashed_password)
    set_committed_value(user, "must_change_password", must_change_password if "must_change_password" in columns else False)
