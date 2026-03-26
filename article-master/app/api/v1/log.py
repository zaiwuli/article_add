from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.api.services import log_service
from app.models import User

router = APIRouter()


@router.get("/files")
def list_logs(user: User = Depends(get_current_user)):
    return log_service.list_log_files()


@router.get("/content")
def read_log_content(
    scope: str = Query(default="app"),
    name: str | None = Query(default=None),
    lines: int = Query(default=200, ge=1, le=1000),
    user: User = Depends(get_current_user),
):
    return log_service.read_log_content(scope=scope, name=name, lines=lines)
