from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.services import crawler_service
from app.core.database import get_db
from app.models import User
from app.schemas.crawler import (
    CrawlerPreviewPayload,
    CrawlerSavePayload,
)

router = APIRouter()


@router.post("/preview")
def preview_crawler_url(
    payload: CrawlerPreviewPayload,
    user: User = Depends(get_current_user),
):
    return crawler_service.preview_url(payload.url)


@router.get("/issues")
def list_crawl_issues(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    issue_type: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.list_crawl_issues(
        db,
        page=page,
        per_page=per_page,
        status=status,
        issue_type=issue_type,
        keyword=keyword,
    )


@router.post("/issues/import-outputs")
def import_crawl_issue_outputs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.import_crawl_issue_outputs(db)


@router.post("/issues/process-auto")
def process_crawl_issues_auto(
    issue_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.process_crawl_issues_auto(db, issue_id=issue_id)


@router.post("/issues/{issue_id}/retry")
def retry_crawl_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.retry_crawl_issue(db, issue_id)


@router.post("/issues/{issue_id}/download")
def download_crawl_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.download_crawl_issue(db, issue_id)


@router.post("/issues/{issue_id}/ignore")
def ignore_crawl_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.ignore_crawl_issue(db, issue_id)


@router.post("/save")
def save_crawler_url(
    payload: CrawlerSavePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return crawler_service.save_url(payload.url, db=db, fid=payload.fid)


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
