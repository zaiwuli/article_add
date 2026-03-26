from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.response import error, success


def has_users(db: Session) -> bool:
    return db.query(User.id).first() is not None


def get_bootstrap_status(db: Session):
    has_user = has_users(db)
    return success(
        {
            "has_user": has_user,
            "allow_register": not has_user,
        }
    )


def create_user(db: Session, username: str, password: str):
    if has_users(db):
        return error("user already exists, bootstrap registration is disabled")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        return error("username already exists")

    user = User(
        username=username,
        hashed_password=get_password_hash(password),
    )
    db.add(user)
    db.flush()
    return success()


def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def update_user(db: Session, username: str, password: str):
    user = db.query(User).first()
    if not user:
        return error("user not found")

    user.username = username
    user.hashed_password = get_password_hash(password)
    db.flush()
    return success()
