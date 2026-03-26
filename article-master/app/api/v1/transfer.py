from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.services import transfer_service
from app.core.database import get_db
from app.models import User
from app.schemas.transfer import TransferTargetPayload

router = APIRouter()


@router.get("/config")
def get_transfer_target_config(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return transfer_service.get_transfer_target_config(db)


@router.post("/config")
def save_transfer_target_config(
    payload: TransferTargetPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return transfer_service.save_transfer_target_config(db, payload)


@router.post("/test")
def test_transfer_target_connection(
    payload: TransferTargetPayload,
    user: User = Depends(get_current_user),
):
    return transfer_service.test_transfer_target_connection(payload)


@router.post("/tables")
def list_transfer_tables(
    payload: TransferTargetPayload,
    user: User = Depends(get_current_user),
):
    return transfer_service.list_transfer_tables(payload)


@router.post("/run")
def transfer_articles(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return transfer_service.transfer_articles(db)
