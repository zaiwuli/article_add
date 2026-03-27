import os
import random
import time
from datetime import datetime
from typing import Dict, Iterable, Optional, Tuple

from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import data_path
from app.core.database import session_scope
from app.models.article import Article
from app.modules.sht import sht
from app.scheduler.sht_section_registry import get_section_config, get_section_configs
from app.utils.log import logger

ARTICLE_INSERT_FIELDS = (
    "tid",
    "title",
    "publish_date",
    "magnet",
    "preview_images",
    "archive_attachment_urls",
    "archive_attachment_names",
    "archive_parse_status",
    "detail_url",
    "size",
    "section",
    "category",
    "website",
    "edk",
)


def sync_sht_by_tid(
    fids: Optional[Iterable] = None,
    start_page: int = 1,
    max_page: int = 100,
):
    return _sync_sections(
        sync_new_article,
        fids=fids,
        start_page=start_page,
        max_page=max_page,
    )


def sync_sht_by_max_page(
    max_page: int = 100,
    fids: Optional[Iterable] = None,
    start_page: int = 1,
):
    return _sync_sections(
        sync_new_article_no_stop,
        fids=fids,
        start_page=start_page,
        max_page=max_page,
    )


def _sync_sections(sync_func, fids: Optional[Iterable], start_page: int, max_page: int):
    messages = []
    for section_config in get_section_configs(fids):
        fid = section_config["fid"]
        section = section_config["section"]
        success_count, page, fail_count = sync_func(fid, start_page, max_page)
        if success_count + fail_count == 0:
            continue
        messages.append(
            f"[{section}] page={page} added={success_count} failed={fail_count}"
        )

    if messages:
        message = "\n".join(messages)
        logger.info(message)
        save_result_to_file(message)
    return messages


def sync_new_article(fid, start_page=1, max_page=100) -> Tuple[int, int, int]:
    section_config = get_section_config(fid)
    section = section_config["section"]
    website = section_config["website"]
    fail_id_list = []
    page = int(start_page)
    max_page = int(max_page)
    articles = []
    seen_tids = set()

    with session_scope() as session:
        stop_tid = (
            session.query(func.max(Article.tid))
            .filter(Article.section == section, Article.website == website)
            .scalar()
            or 0
        )

    logger.info(f"[{section}] latest saved tid: {stop_tid}")
    while page <= max_page:
        time.sleep(1)
        logger.info(f"[{section}] fetch page {page}")
        tid_list = _fetch_tid_list(fid, page)
        if not tid_list:
            logger.info(f"[{section}] stop after retries on page {page}")
            break

        min_tid = min(tid_list)
        logger.info(f"[{section}] min tid on page {page}: {min_tid}")
        articles_added, page_fail_ids = _crawl_articles(section_config, tid_list, seen_tids)
        articles.extend(articles_added)
        fail_id_list.extend(page_fail_ids)

        if min_tid <= stop_tid:
            logger.info(f"[{section}] reached historical boundary")
            break
        page += 1

    inserted_count = _save_articles(articles)
    retry_fail_id_list = retry_fail_tid(fid, fail_id_list)
    save_fail_tid_to_file(fid, retry_fail_id_list)
    return inserted_count, page, len(retry_fail_id_list)


def sync_new_article_no_stop(fid, start_page=1, max_page=100) -> Tuple[int, int, int]:
    section_config = get_section_config(fid)
    section = section_config["section"]
    page = int(start_page)
    max_page = int(max_page)
    fail_id_list = []
    articles = []
    seen_tids = set()

    while page <= max_page:
        time.sleep(1)
        logger.info(f"[{section}] fetch page {page}")
        tid_list = _fetch_tid_list(fid, page)
        if not tid_list:
            logger.info(f"[{section}] stop after retries on page {page}")
            break

        articles_added, page_fail_ids = _crawl_articles(section_config, tid_list, seen_tids)
        articles.extend(articles_added)
        fail_id_list.extend(page_fail_ids)
        page += 1

    inserted_count = _save_articles(articles)
    retry_fail_id_list = retry_fail_tid(fid, fail_id_list)
    save_fail_tid_to_file(fid, retry_fail_id_list)
    return inserted_count, page, len(retry_fail_id_list)


def _fetch_tid_list(fid, page):
    for retry in range(3):
        tid_list = sht.crawler_tid_list(
            f"https://sehuatang.org/forum.php?mod=forumdisplay&fid={fid}&mobile=2&page={page}"
        )
        if tid_list:
            return tid_list
        logger.warning(f"page {page} fetch failed, retry {retry + 1}/3")
        time.sleep(10)
    return []


def _crawl_articles(section_config: Dict[str, str], tid_list, seen_tids=None):
    website = section_config["website"]
    section = section_config["section"]
    articles = []
    fail_id_list = []
    seen_tids = seen_tids if seen_tids is not None else set()

    unique_tid_list = list(dict.fromkeys(tid_list))
    with session_scope() as session:
        existing_article_tids = set(
            session.execute(
                select(Article.tid).filter(
                    Article.website == website,
                    Article.tid.in_(unique_tid_list),
                )
            )
            .scalars()
            .all()
        )

    for tid in unique_tid_list:
        if tid in existing_article_tids or tid in seen_tids:
            continue

        detail_url = (
            "https://sehuatang.org/forum.php?"
            f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
        )

        try:
            data = sht.crawler_detail(detail_url)
            if not data:
                fail_id_list.append(tid)
                continue

            data.update(
                {
                    "tid": tid,
                    "section": section,
                    "website": website,
                    "detail_url": detail_url,
                }
            )
            articles.append(Article(data))
            seen_tids.add(tid)
            time.sleep(1)
        except Exception as exc:
            logger.error(f"[{section}] crawl tid={tid} failed: {exc}")
            fail_id_list.append(tid)

    return articles, fail_id_list


def _article_to_payload(article: Article):
    return {
        field: getattr(article, field)
        for field in ARTICLE_INSERT_FIELDS
    }


def _prepare_insert_payloads(articles):
    unique_payloads = {}
    for article in articles:
        if not article.website or article.tid is None:
            continue
        unique_payloads[(article.website, article.tid)] = _article_to_payload(article)
    return list(unique_payloads.values())


def _filter_existing_payloads(session, payloads):
    if not payloads:
        return []

    existing_pairs = set(
        session.execute(
            select(Article.website, Article.tid).where(
                tuple_(Article.website, Article.tid).in_(
                    [(payload["website"], payload["tid"]) for payload in payloads]
                )
            )
        ).all()
    )

    return [
        payload
        for payload in payloads
        if (payload["website"], payload["tid"]) not in existing_pairs
    ]


def _save_articles(articles):
    payloads = _prepare_insert_payloads(articles)
    if not payloads:
        return 0

    with session_scope() as session:
        pending_payloads = _filter_existing_payloads(session, payloads)
        if not pending_payloads:
            logger.info("skip insert because all crawled articles already exist")
            return 0

        if session.bind is not None and session.bind.dialect.name == "postgresql":
            stmt = pg_insert(Article.__table__).values(pending_payloads)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["website", "tid"]
            )
            result = session.execute(stmt)
            inserted_count = result.rowcount if result.rowcount and result.rowcount > 0 else 0
            logger.info(
                f"saved {inserted_count} articles, skipped {len(payloads) - inserted_count} duplicates"
            )
            return inserted_count

        session.add_all([Article(payload) for payload in pending_payloads])
        logger.info(
            f"saved {len(pending_payloads)} articles, skipped {len(payloads) - len(pending_payloads)} duplicates"
        )
        return len(pending_payloads)


def save_fail_tid_to_file(fid, fail_id_list):
    if not fail_id_list:
        return

    base_dir = os.path.join(data_path, "fails")
    os.makedirs(base_dir, exist_ok=True)
    now_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    file_name = f"{fid}-fail_tid_{now_str}.txt"
    file_path = os.path.join(base_dir, file_name)
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(f"failed_ids={','.join(str(item) for item in fail_id_list)}\n")
    logger.warning(f"saved failed tids to {file_path}")


def save_result_to_file(message):
    if not message:
        return
    base_dir = os.path.join(data_path, "result")
    os.makedirs(base_dir, exist_ok=True)
    now_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    file_name = f"message_{now_str}.txt"
    file_path = os.path.join(base_dir, file_name)
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(message)
    logger.warning(f"saved crawl summary to {file_path}")


def retry_fail_tid(fid, fail_id_list):
    section_config = get_section_config(fid)
    section = section_config["section"]
    fail_id_list = list(dict.fromkeys(fail_id_list))
    if not fail_id_list:
        return []

    logger.info(f"[{section}] retry failed tids: {len(fail_id_list)}")
    articles = []
    for tid in fail_id_list[:]:
        detail_url = (
            "https://sehuatang.org/forum.php?"
            f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
        )
        try:
            data = sht.crawler_detail(detail_url)
            if not data:
                continue
            data.update(
                {
                    "tid": tid,
                    "section": section_config["section"],
                    "website": section_config["website"],
                    "detail_url": detail_url,
                }
            )
            articles.append(Article(data))
            fail_id_list.remove(tid)
            time.sleep(random.uniform(2, 3))
        except Exception as exc:
            logger.exception(f"[{section}] retry tid={tid} failed again: {exc}")

    _save_articles(articles)
    logger.info(f"[{section}] remaining failed tids: {fail_id_list}")
    return fail_id_list
