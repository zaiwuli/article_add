from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.services import user_service
from app.core.database import get_db
from app.core.security import create_access_token
from app.models import User
from app.schemas.response import error, success
from app.schemas.user import UserPayload

router = APIRouter()


@router.get("/bootstrap-status")
def get_bootstrap_status(db: Session = Depends(get_db)):
    return user_service.get_bootstrap_status(db)


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = user_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        return error("username or password is incorrect")
    token = create_access_token({"sub": user.username})
    return success({"access_token": token})


@router.post("/")
def create_user(payload: UserPayload, db: Session = Depends(get_db)):
    return user_service.create_user(db, payload.username, payload.password)


@router.put("/")
def update_user(
    payload: UserPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return user_service.update_user(db, payload.username, payload.password)
