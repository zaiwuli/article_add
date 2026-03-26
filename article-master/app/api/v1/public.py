from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.services import article_service
from app.core.database import get_db
from app.schemas.article import ArticleQuery

router = APIRouter()


@router.post("/articles/search")
def get_article_list(query: ArticleQuery, db: Session = Depends(get_db)):
    return article_service.get_article_list(db, query)


@router.get("/articles/categories")
def get_category(db: Session = Depends(get_db)):
    return article_service.get_category(db)


@router.get("/articles/torrents")
def get_torrent(keyword, db: Session = Depends(get_db)):
    return article_service.get_torrents(keyword, db)
