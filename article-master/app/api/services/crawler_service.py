from urllib.parse import parse_qs, urlparse

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.services.user_service import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
)
from app.core.security import get_password_hash
from app.models.article import Article
from app.models.config import Config
from app.models.task import Task
from app.models.user import User
from app.modules.sht import sht
from app.scheduler.sht_section_registry import get_section_config
from app.schemas.response import error, success


def _extract_query_value(url: str, key: str):
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get(key, [])
    return values[0] if values else None


def _build_detail_url(url: str, tid: int):
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc or "sehuatang.org"
    return (
        f"{scheme}://{netloc}/forum.php?"
        f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
    )


def _normalize_website(url: str, fallback: str | None = None):
    parsed = urlparse(url)
    return (fallback or parsed.netloc or "sehuatang").strip()


def _upsert_article(db: Session, data: dict):
    article = (
        db.query(Article)
        .filter(Article.website == data["website"], Article.tid == data["tid"])
        .first()
    )
    if article:
        for key, value in data.items():
            setattr(article, key, value)
        return "updated"

    db.add(Article(data))
    return "created"


def _save_detail_url(
    db: Session,
    url: str,
    tid: int,
    section: str,
    website: str,
):
    article = sht.crawler_detail(url)
    if not article:
        return None

    payload = dict(article)
    payload.update(
        {
            "tid": tid,
            "section": section,
            "website": website,
            "detail_url": url,
        }
    )
    return _upsert_article(db, payload)


def preview_url(url: str):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("invalid url")

    runtime = sht.get_runtime_config()
    mod = _extract_query_value(url, "mod")

    if mod == "forumdisplay" or _extract_query_value(url, "fid"):
        tid_list = sht.crawler_tid_list(url)
        return success(
            {
                "mode": "forumdisplay",
                "url": url,
                "fid": _extract_query_value(url, "fid"),
                "count": len(tid_list),
                "items": [
                    {
                        "tid": tid,
                        "detail_url": _build_detail_url(url, tid),
                    }
                    for tid in tid_list
                ],
                "runtime": runtime,
            }
        )

    if mod == "viewthread" or _extract_query_value(url, "tid"):
        article = sht.crawler_detail(url)
        if not article:
            return error("failed to crawl target url")

        article["tid"] = _extract_query_value(url, "tid")
        article["detail_url"] = url
        article["website"] = parsed.netloc
        return success(
            {
                "mode": "viewthread",
                "url": url,
                "article": article,
                "runtime": runtime,
            }
        )

    return error("unsupported url, only forumdisplay and viewthread are supported")


def save_url(url: str, db: Session, fid: str | None = None):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("invalid url")

    mod = _extract_query_value(url, "mod")
    if mod == "forumdisplay" or _extract_query_value(url, "fid"):
        target_fid = fid or _extract_query_value(url, "fid")
        if not target_fid:
            return error("fid is required for forumdisplay save")

        section_config = get_section_config(target_fid)
        section = section_config["section"]
        website = _normalize_website(url, section_config.get("website"))
        tid_list = sht.crawler_tid_list(url)
        if not tid_list:
            return error("failed to crawl target url")

        existing_tids = set(
            db.execute(
                select(Article.tid).filter(
                    Article.website == website,
                    Article.tid.in_(tid_list),
                )
            )
            .scalars()
            .all()
        )

        created = 0
        updated = 0
        failed_ids = []
        for tid in tid_list:
            detail_url = _build_detail_url(url, tid)
            status = _save_detail_url(
                db=db,
                url=detail_url,
                tid=tid,
                section=section,
                website=website,
            )
            if status == "created":
                created += 1
                continue
            if status == "updated":
                if tid in existing_tids:
                    updated += 1
                else:
                    created += 1
                continue
            failed_ids.append(tid)

        db.flush()
        return success(
            {
                "mode": "forumdisplay",
                "fid": str(target_fid),
                "section": section,
                "website": website,
                "count": len(tid_list),
                "created": created,
                "updated": updated,
                "failed_ids": failed_ids,
            },
            message="resources saved",
        )

    if mod == "viewthread" or _extract_query_value(url, "tid"):
        tid = _extract_query_value(url, "tid")
        if not tid:
            return error("tid is required for viewthread save")

        section_config = get_section_config(fid) if fid else None
        section = section_config["section"] if section_config else "manual"
        website = _normalize_website(
            url,
            section_config.get("website") if section_config else None,
        )
        status = _save_detail_url(
            db=db,
            url=url,
            tid=int(tid),
            section=section,
            website=website,
        )
        if not status:
            return error("failed to crawl target url")

        db.flush()
        return success(
            {
                "mode": "viewthread",
                "tid": int(tid),
                "section": section,
                "website": website,
                "action": status,
            },
            message="resource saved",
        )

    return error("unsupported url, only forumdisplay and viewthread are supported")


def reset_resource_table(db: Session):
    count = db.execute(select(func.count(Article.id))).scalar() or 0
    db.execute(text("TRUNCATE TABLE sht.article RESTART IDENTITY"))
    db.flush()
    return success(
        {
            "deleted": count,
        },
        message="resource table reset",
    )


def reset_test_space(db: Session):
    article_count = db.execute(select(func.count(Article.id))).scalar() or 0
    task_count = db.execute(select(func.count(Task.id))).scalar() or 0
    config_count = db.execute(select(func.count(Config.id))).scalar() or 0
    user_count = db.execute(select(func.count(User.id))).scalar() or 0

    db.execute(
        text(
            "TRUNCATE TABLE sht.article, sht.task, sht.config, sht.\"user\" RESTART IDENTITY"
        )
    )

    admin_user = User(
        username=DEFAULT_ADMIN_USERNAME,
        hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
    )
    db.add(admin_user)

    db.flush()
    return success(
        {
            "article_deleted": article_count,
            "task_deleted": task_count,
            "config_deleted": config_count,
            "user_deleted": user_count,
            "default_username": DEFAULT_ADMIN_USERNAME,
            "default_password": DEFAULT_ADMIN_PASSWORD,
        },
        message="test space reset",
    )
