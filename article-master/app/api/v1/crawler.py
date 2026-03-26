from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.api.services import crawler_service
from app.models import User
from app.schemas.crawler import CrawlerPreviewPayload

router = APIRouter()


@router.post("/preview")
def preview_crawler_url(
    payload: CrawlerPreviewPayload,
    user: User = Depends(get_current_user),
):
    return crawler_service.preview_url(payload.url)
