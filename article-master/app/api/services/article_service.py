import json
import re
from typing import Dict, List

from sqlalchemy import exists, func
from sqlalchemy.orm import Session

from app.core.database import session_scope
from app.models import Config, DownloadLog
from app.models.article import Article
from app.modules.downloadclient import downloadManager
from app.schemas.article import ArticleQuery
from app.schemas.response import error, success

CN_KEYWORDS: List[str] = [
    "\u4e2d\u6587\u5b57\u5e55",
    "\u4e2d\u5b57",
    "\u5b57\u5e55",
    "\u4e2d\u6587",
]
UC_KEYWORDS: List[str] = ["UC", "\u65e0\u7801", "\u6b65\u5175"]
UHD_KEYWORDS: List[str] = ["4k", "8k", "2160p", "4K", "8K", "2160P"]


def get_article_list(db: Session, query: ArticleQuery) -> Dict:
    in_stock_expr = exists().where(DownloadLog.tid == Article.tid)

    q = db.query(Article, in_stock_expr.label("in_stock"))
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

    rows = q.order_by(Article.tid.desc()).offset(offset).limit(per_page).all()
    items = []
    for article, in_stock in rows:
        setattr(article, "in_stock", in_stock)
        items.append(article)

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


def calc_score(rule, section, category, title):
    score = 0

    rule_section = rule.get("category") or "ALL"
    if rule_section == section:
        score += 10
    elif rule_section == "ALL":
        score += 1
    else:
        return 0

    rule_category = rule.get("subCategory") or "ALL"
    if rule_category == (category or ""):
        score += 5
    elif rule_category == "ALL":
        score += 1
    else:
        return 0

    rule_regex = rule.get("regex")
    if rule_regex:
        if re.search(rule_regex, title):
            score += 20
        else:
            return 0
    else:
        score += 1

    return score


def match_best_rules(rules, section, category, title):
    best_score = 0
    best_rules = []

    for rule in rules:
        score = calc_score(rule, section, category, title)
        if score == 0:
            continue

        if score > best_score:
            best_score = score
            best_rules = [rule]
        elif score == best_score:
            best_rules.append(rule)

    return best_rules


def download_magnet(tid, magnet, downloader, save_path):
    is_success = downloadManager.get(f"Downloader.{downloader}").download(
        magnet,
        save_path,
    )
    if is_success:
        with session_scope() as db:
            download_log = DownloadLog()
            download_log.tid = tid
            download_log.magnet = magnet
            download_log.save_path = save_path
            download_log.downloader = downloader
            db.add(download_log)
    return is_success


def get_article_by_tid(db: Session, tid: int):
    return db.query(Article).filter(Article.tid == tid).first()


def download_article(tid: int):
    with session_scope() as db:
        article = get_article_by_tid(db, tid)
        config = db.query(Config).filter(Config.key == "DownloadFolder").first()

    if not article:
        return error("article not found")
    if not config:
        return error("download folder rules not configured")

    success_count = 0
    rules = json.loads(str(config.content))
    if rules:
        best_rules = match_best_rules(
            rules,
            article.section,
            article.category,
            article.title,
        )
        for rule in best_rules:
            is_success = download_magnet(
                article.tid,
                article.magnet,
                rule["downloader"],
                rule["savePath"],
            )
            if is_success:
                success_count += 1

    if success_count > 0:
        return success("download task created")
    return error("failed to create download task")


def manul_download(tid, downloader, save_path):
    with session_scope() as db:
        article = get_article_by_tid(db, tid)

    if not article:
        return error("article not found")

    is_success = download_magnet(article.tid, article.magnet, downloader, save_path)
    if is_success:
        return success("download task created")
    return error("failed to create download task")
