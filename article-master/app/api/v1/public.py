from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.services import article_service
from app.core.database import get_db
from app.schemas.article import ArticleQuery

router = APIRouter()


@router.get("/articles")
def list_articles(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    keyword: str | None = Query(default=None),
    section: str | None = Query(default=None),
    category: str | None = Query(default=None),
    website: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = ArticleQuery(
        page=page,
        per_page=per_page,
        keyword=keyword,
        section=section,
        category=category,
        website=website,
    )
    return article_service.get_article_list(db, query)


@router.post("/articles/search")
def get_article_list(query: ArticleQuery, db: Session = Depends(get_db)):
    return article_service.get_article_list(db, query)


@router.get("/articles/categories")
def get_category(db: Session = Depends(get_db)):
    return article_service.get_category(db)


@router.get("/articles/torrents")
def get_torrent(keyword, db: Session = Depends(get_db)):
    return article_service.get_torrents(keyword, db)
