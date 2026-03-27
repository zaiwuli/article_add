import os
import random
import time
from datetime import datetime
from typing import Dict, Iterable, Optional, Tuple

from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.api.services import crawler_service
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
    issue_payloads = []
    resolved_pairs = []
    seen_tids = set()

    with session_scope() as session:
        stop_tid = (
            session.query(func.max(Article.tid))
            .filter(Article.section == section, Article.website == website)
            .scalar()
            or 0
        )

    logger.info(f"[{section}] 当前已保存的最新 tid: {stop_tid}")
    while page <= max_page:
        time.sleep(1)
        logger.info(f"[{section}] 开始抓取第 {page} 页")
        tid_list = _fetch_tid_list(fid, page)
        if not tid_list:
            logger.info(f"[{section}] 第 {page} 页重试后仍失败，停止继续抓取")
            break

        min_tid = min(tid_list)
        logger.info(f"[{section}] 第 {page} 页最小 tid: {min_tid}")
        (
            articles_added,
            page_issue_payloads,
            page_resolved_pairs,
            page_fail_ids,
        ) = _crawl_articles(section_config, tid_list, seen_tids)
        articles.extend(articles_added)
        issue_payloads.extend(page_issue_payloads)
        resolved_pairs.extend(page_resolved_pairs)
        fail_id_list.extend(page_fail_ids)

        if min_tid <= stop_tid:
            logger.info(f"[{section}] 已触达历史边界，停止增量抓取")
            break
        page += 1

    inserted_count = _save_articles(articles)
    with session_scope() as session:
        crawler_service.save_crawl_issues(session, issue_payloads)
        crawler_service.clear_crawl_issues(session, resolved_pairs)
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
    issue_payloads = []
    resolved_pairs = []
    seen_tids = set()

    while page <= max_page:
        time.sleep(1)
        logger.info(f"[{section}] 开始抓取第 {page} 页")
        tid_list = _fetch_tid_list(fid, page)
        if not tid_list:
            logger.info(f"[{section}] 第 {page} 页重试后仍失败，停止继续抓取")
            break

        (
            articles_added,
            page_issue_payloads,
            page_resolved_pairs,
            page_fail_ids,
        ) = _crawl_articles(section_config, tid_list, seen_tids)
        articles.extend(articles_added)
        issue_payloads.extend(page_issue_payloads)
        resolved_pairs.extend(page_resolved_pairs)
        fail_id_list.extend(page_fail_ids)
        page += 1

    inserted_count = _save_articles(articles)
    with session_scope() as session:
        crawler_service.save_crawl_issues(session, issue_payloads)
        crawler_service.clear_crawl_issues(session, resolved_pairs)
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
        logger.warning(f"第 {page} 页抓取失败，正在重试 {retry + 1}/3")
        time.sleep(10)
    return []


def _crawl_articles(section_config: Dict[str, str], tid_list, seen_tids=None):
    fid = str(section_config.get("fid") or "")
    website = section_config["website"]
    section = section_config["section"]
    articles = []
    issue_payloads = []
    resolved_pairs = []
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
        if tid in existing_article_tids:
            resolved_pairs.append((website, tid))
            continue
        if tid in seen_tids:
            continue

        detail_url = (
            "https://sehuatang.org/forum.php?"
            f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
        )

        try:
            result = sht.inspect_detail(detail_url)
            article_payload = crawler_service.build_article_payload(
                result,
                tid=tid,
                fid=fid,
                section=section,
                website=website,
                detail_url=detail_url,
            )
            if article_payload:
                articles.append(Article(article_payload))
                resolved_pairs.append((website, tid))
                seen_tids.add(tid)
                time.sleep(1)
                continue

            issue_payload = crawler_service.build_crawl_issue_payload(
                result,
                tid=tid,
                fid=fid,
                section=section,
                website=website,
                detail_url=detail_url,
            )
            issue_payloads.append(issue_payload)
            if issue_payload["status"] == crawler_service.ISSUE_STATUS_FAILED:
                fail_id_list.append(tid)
            time.sleep(1)
        except Exception as exc:
            logger.error(f"[{section}] 抓取 tid={tid} 失败: {exc}")
            fail_id_list.append(tid)

    return articles, issue_payloads, resolved_pairs, fail_id_list


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
            logger.info("本轮抓取结果均已存在，跳过写入")
            return 0

        if session.bind is not None and session.bind.dialect.name == "postgresql":
            stmt = pg_insert(Article.__table__).values(pending_payloads)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["website", "tid"]
            )
            result = session.execute(stmt)
            inserted_count = result.rowcount if result.rowcount and result.rowcount > 0 else 0
            logger.info(
                f"资源写入完成: 新增 {inserted_count} 条，跳过重复 {len(payloads) - inserted_count} 条"
            )
            return inserted_count

        session.add_all([Article(payload) for payload in pending_payloads])
        logger.info(
            f"资源写入完成: 新增 {len(pending_payloads)} 条，跳过重复 {len(payloads) - len(pending_payloads)} 条"
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
    logger.warning(f"失败 tid 已保存到: {file_path}")


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
    logger.warning(f"抓取摘要已保存到: {file_path}")


def retry_fail_tid(fid, fail_id_list):
    section_config = get_section_config(fid)
    section = section_config["section"]
    website = section_config["website"]
    fail_id_list = list(dict.fromkeys(fail_id_list))
    if not fail_id_list:
        return []

    logger.info(f"[{section}] 开始重试失败 tid，数量: {len(fail_id_list)}")
    articles = []
    issue_payloads = []
    resolved_pairs = []
    for tid in fail_id_list[:]:
        detail_url = (
            "https://sehuatang.org/forum.php?"
            f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
        )
        try:
            result = sht.inspect_detail(detail_url)
            article_payload = crawler_service.build_article_payload(
                result,
                tid=tid,
                fid=str(fid),
                section=section,
                website=website,
                detail_url=detail_url,
            )
            if article_payload:
                articles.append(Article(article_payload))
                resolved_pairs.append((website, tid))
                fail_id_list.remove(tid)
                time.sleep(random.uniform(2, 3))
                continue

            issue_payload = crawler_service.build_crawl_issue_payload(
                result,
                tid=tid,
                fid=str(fid),
                section=section,
                website=website,
                detail_url=detail_url,
            )
            issue_payloads.append(issue_payload)
            if issue_payload["status"] != crawler_service.ISSUE_STATUS_FAILED:
                fail_id_list.remove(tid)
            time.sleep(random.uniform(2, 3))
        except Exception as exc:
            logger.exception(f"[{section}] 重试 tid={tid} 再次失败: {exc}")

    _save_articles(articles)
    with session_scope() as session:
        crawler_service.save_crawl_issues(session, issue_payloads, increment_retry=True)
        crawler_service.clear_crawl_issues(session, resolved_pairs)
    logger.info(f"[{section}] 仍然失败的 tid 列表: {fail_id_list}")
    return fail_id_list


def sync_crawl_issue_outputs():
    with session_scope() as session:
        result = crawler_service.import_crawl_issue_outputs(session)
    data = result.get("data") or {}
    logger.info(
        "解压输出扫描完成: "
        f"导入 {data.get('imported', 0)} 条，跳过 {len(data.get('skipped', []))} 条"
    )
    return data
