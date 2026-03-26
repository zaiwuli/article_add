from typing import Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.article import Article
from app.schemas.article import ArticleQuery
from app.schemas.response import success

CN_KEYWORDS: List[str] = [
    "中文字幕",
    "中字",
    "字幕",
    "中文",
]
UC_KEYWORDS: List[str] = ["UC", "无码", "步兵"]
UHD_KEYWORDS: List[str] = ["4k", "8k", "2160p", "4K", "8K", "2160P"]


def get_article_list(db: Session, query: ArticleQuery) -> Dict:
    q = db.query(Article)
    if query.keyword:
        q = q.filter(Article.title.ilike(f"%{query.keyword}%"))
    if query.section:
        q = q.filter(Article.section == query.section)
    if query.category:
        q = q.filter(Article.category == query.category)
    if query.publish_date_range:
        date_from = query.publish_date_range.get("from")
        date_to = query.publish_date_range.get("to")
        if date_from:
            q = q.filter(Article.publish_date >= date_from)
        if date_to:
            q = q.filter(Article.publish_date <= date_to)

    total = q.count()
    page = query.page
    per_page = query.per_page
    offset = (page - 1) * per_page
    items = q.order_by(Article.tid.desc()).offset(offset).limit(per_page).all()

    return success(
        {
            "page": page,
            "per_page": per_page,
            "total": total,
            "items": items,
        }
    )


def has_chinese(title: str) -> bool:
    return any(keyword in title for keyword in CN_KEYWORDS)


def has_uc(title: str) -> bool:
    return any(keyword in title for keyword in UC_KEYWORDS)


def has_uhd(title: str) -> bool:
    return any(keyword in title for keyword in UHD_KEYWORDS)


def get_torrents(keyword, db: Session) -> Dict:
    articles = db.query(Article).filter(Article.title.ilike(f"%{keyword}%")).all()
    torrents = []
    for article in articles:
        search_text = f"{article.title}{article.section}{article.category or ''}"
        torrents.append(
            {
                "id": article.tid,
                "site": article.website,
                "size_mb": article.size,
                "seeders": 66,
                "title": article.title,
                "download_url": article.magnet,
                "free": True,
                "chinese": has_chinese(search_text),
                "uc": has_uc(search_text),
                "uhd": has_uhd(search_text),
            }
        )
    return success(torrents)


def get_category(db: Session):
    item_count = func.count(Article.id).label("item_count")
    result = (
        db.query(Article.section, Article.category, item_count)
        .group_by(Article.section, Article.category)
        .order_by(item_count.desc())
        .all()
    )
    grouped = {}

    for section, category, count in result:
        if section not in grouped:
            grouped[section] = {
                "category": section,
                "count": 0,
                "items": [],
            }
        if category:
            grouped[section]["items"].append(
                {
                    "category": category,
                    "count": count,
                }
            )
        grouped[section]["count"] += count
    return success(list(grouped.values()))
