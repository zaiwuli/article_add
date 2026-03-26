from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.services import crawler_service
from app.core.database import get_db
from app.models import User
from app.schemas.crawler import (
    CrawlerPreviewPayload,
    CrawlerSavePayload,
    TransferArticlePayload,
    TransferTablePayload,
)

router = APIRouter()


@router.post("/preview")
def preview_crawler_url(
    payload: CrawlerPreviewPayload,
    user: User = Depends(get_current_user),
):
    return crawler_service.preview_url(payload.url)


@router.post("/save")
def save_crawler_url(
    payload: CrawlerSavePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.save_url(payload.url, db=db, fid=payload.fid)


@router.post("/transfer/tables")
def list_transfer_tables(
    payload: TransferTablePayload,
    user: User = Depends(get_current_user),
):
    return crawler_service.list_transfer_tables(payload.database_url)


@router.post("/transfer/articles")
def transfer_articles(
    payload: TransferArticlePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.transfer_articles(
        payload.database_url,
        payload.table_name,
        db=db,
    )


@router.post("/reset-resource-table")
def reset_resource_table(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.reset_resource_table(db)


@router.post("/reset-test-space")
def reset_test_space(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.reset_test_space(db)
