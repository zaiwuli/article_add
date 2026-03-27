import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.api.services.article_service import normalize_string_list
from app.api.services.config_service import (
    CRAWLER_AUTO_EXTRACT_CONFIG_KEY,
    CRAWLER_ISSUE_HANDLING_CONFIG_KEY,
    get_default_crawler_auto_extract_config,
    get_default_crawler_issue_handling_config,
    load_config_payload,
    save_option,
)
from app.api.services.user_service import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
)
from app.core.security import get_password_hash
from app.models.article import Article
from app.models.config import Config
from app.models.crawl_issue import CrawlIssue
from app.models.task import Task
from app.models.user import User
from app.modules.archive_extractor import (
    extract_archive_file,
    split_password_dictionary,
)
from app.modules.sht import TEXT_ATTACHMENT_EXTENSIONS, extract_edk, extract_magnet, sht
from app.scheduler.sht_section_registry import get_section_config
from app.schemas.config import JsonPayload
from app.schemas.response import error, success

ISSUE_STATUS_FAILED = "failed"
ISSUE_STATUS_PENDING_MANUAL = "pending_manual"
ISSUE_STATUS_DOWNLOADED = "downloaded"
ISSUE_STATUS_IGNORED = "ignored"

ISSUE_TYPE_ARCHIVE = "archive_detected"
OUTPUT_SCAN_EXTENSIONS = {".torrent", ".txt", ".nfo"}
SAFE_FILENAME_PATTERN = re.compile(r"[^0-9A-Za-z._-]+")


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


def _normalize_issue_handling_config(payload: dict | None):
    data = get_default_crawler_issue_handling_config()
    if isinstance(payload, dict):
        data.update(payload)
    data["watch_path"] = str(data.get("watch_path") or "").strip() or data["watch_path"]
    data["output_path"] = (
        str(data.get("output_path") or "").strip() or data["output_path"]
    )
    return data


def load_crawl_issue_handling_config(db: Session):
    payload = load_config_payload(CRAWLER_ISSUE_HANDLING_CONFIG_KEY, db)
    return _normalize_issue_handling_config(payload)


def _normalize_auto_extract_config(payload: dict | None):
    data = get_default_crawler_auto_extract_config()
    if isinstance(payload, dict):
        data.update(payload)
    data["enabled"] = bool(data.get("enabled", False))
    data["schedule_enabled"] = bool(data.get("schedule_enabled", False))
    data["schedule_cron"] = str(data.get("schedule_cron") or "").strip()
    data["archive_path"] = str(data.get("archive_path") or "").strip() or data["archive_path"]
    data["move_original"] = bool(data.get("move_original", True))
    data["delete_original"] = bool(data.get("delete_original", False))
    if data["delete_original"]:
        data["move_original"] = False
    data["password_dictionary"] = str(data.get("password_dictionary") or "").strip()
    return data


def load_crawl_auto_extract_config(db: Session):
    payload = load_config_payload(CRAWLER_AUTO_EXTRACT_CONFIG_KEY, db)
    return _normalize_auto_extract_config(payload)


def get_crawl_issue_handling_config(db: Session):
    return success(load_crawl_issue_handling_config(db))


def save_crawl_issue_handling_config(db: Session, payload: dict):
    data = _normalize_issue_handling_config(payload)
    if not data["watch_path"]:
        return error("监控目录不能为空")
    if not data["output_path"]:
        return error("解压输出目录不能为空")

    result = save_option(
        JsonPayload(
            key=CRAWLER_ISSUE_HANDLING_CONFIG_KEY,
            payload=data,
        ),
        db,
    )
    db.commit()
    return result


def _serialize_crawl_issue(issue: CrawlIssue):
    return {
        "id": issue.id,
        "tid": issue.tid,
        "fid": issue.fid,
        "title": issue.title,
        "publish_date": issue.publish_date.isoformat()
        if issue.publish_date
        else None,
        "preview_images": normalize_string_list(issue.preview_images),
        "detail_url": issue.detail_url,
        "size": issue.size,
        "section": issue.section,
        "category": issue.category,
        "website": issue.website,
        "status": issue.status,
        "issue_type": issue.issue_type,
        "stage": issue.stage,
        "reason_code": issue.reason_code,
        "reason_message": issue.reason_message,
        "password_candidates": normalize_string_list(issue.password_candidates),
        "attachment_urls": normalize_string_list(issue.attachment_urls),
        "attachment_names": normalize_string_list(issue.attachment_names),
        "attachment_types": normalize_string_list(issue.attachment_types),
        "retry_count": issue.retry_count,
        "create_time": issue.create_time.isoformat() if issue.create_time else None,
        "update_time": issue.update_time.isoformat() if issue.update_time else None,
    }


def _serialize_preview_issue(result: dict):
    return {
        "status": result.get("status"),
        "issue_type": result.get("issue_type"),
        "stage": result.get("stage"),
        "reason_code": result.get("reason_code"),
        "reason_message": result.get("reason_message"),
        "password_candidates": normalize_string_list(result.get("password_candidates")),
        "attachments": result.get("attachments") or [],
        "title": result.get("title"),
        "category": result.get("category"),
        "publish_date": result.get("publish_date"),
        "preview_images": normalize_string_list(result.get("preview_images")),
        "size": result.get("size"),
    }


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


def build_article_payload(
    result: dict,
    *,
    tid: int,
    fid: str | None,
    section: str,
    website: str,
    detail_url: str,
):
    if not result.get("ok") or not result.get("article"):
        return None

    payload = dict(result["article"])
    payload.update(
        {
            "tid": tid,
            "section": section,
            "website": website,
            "detail_url": detail_url,
        }
    )
    return payload


def build_crawl_issue_payload(
    result: dict,
    *,
    tid: int,
    fid: str | None,
    section: str,
    website: str,
    detail_url: str,
):
    attachments = result.get("attachments") or []
    return {
        "tid": tid,
        "fid": str(fid) if fid is not None else None,
        "title": result.get("title"),
        "publish_date": result.get("publish_date"),
        "preview_images": normalize_string_list(result.get("preview_images")),
        "detail_url": detail_url,
        "size": result.get("size"),
        "section": section,
        "category": result.get("category"),
        "website": website,
        "status": result.get("status") or ISSUE_STATUS_FAILED,
        "issue_type": result.get("issue_type") or "resource_missing",
        "stage": result.get("stage"),
        "reason_code": result.get("reason_code"),
        "reason_message": result.get("reason_message"),
        "password_candidates": normalize_string_list(result.get("password_candidates")),
        "attachment_urls": [item.get("url") for item in attachments if item.get("url")],
        "attachment_names": [
            item.get("name") for item in attachments if item.get("name")
        ],
        "attachment_types": [
            item.get("ext") for item in attachments if item.get("ext")
        ],
    }


def _issue_retry_seed(payload: dict, increment_retry: bool):
    if payload.get("status") != ISSUE_STATUS_FAILED:
        return 0
    return 1 if increment_retry else 0


def upsert_crawl_issue(db: Session, payload: dict, increment_retry: bool = False):
    issue = (
        db.query(CrawlIssue)
        .filter(CrawlIssue.website == payload["website"], CrawlIssue.tid == payload["tid"])
        .first()
    )
    if issue:
        retry_count = issue.retry_count or 0
        if payload.get("status") == ISSUE_STATUS_FAILED and increment_retry:
            retry_count += 1
        payload["retry_count"] = retry_count
        for key, value in payload.items():
            setattr(issue, key, value)
        db.flush()
        return issue, "updated"

    payload = dict(payload)
    payload["retry_count"] = _issue_retry_seed(payload, increment_retry)
    issue = CrawlIssue(payload)
    db.add(issue)
    db.flush()
    return issue, "created"


def save_crawl_issues(db: Session, payloads: list[dict], increment_retry: bool = False):
    results = []
    for payload in payloads:
        issue, action = upsert_crawl_issue(db, payload, increment_retry=increment_retry)
        results.append((issue, action))
    return results


def clear_crawl_issues(db: Session, pairs: list[tuple[str, int]]):
    unique_pairs = {
        (str(website), int(tid))
        for website, tid in pairs
        if website and tid is not None
    }
    if not unique_pairs:
        return 0

    deleted = 0
    for website, tid in unique_pairs:
        issue = (
            db.query(CrawlIssue)
            .filter(CrawlIssue.website == website, CrawlIssue.tid == tid)
            .first()
        )
        if issue:
            db.delete(issue)
            deleted += 1
    db.flush()
    return deleted


def _save_detail_url(
    db: Session,
    url: str,
    tid: int,
    fid: str | None,
    section: str,
    website: str,
):
    result = sht.inspect_detail(url)
    article_payload = build_article_payload(
        result,
        tid=tid,
        fid=fid,
        section=section,
        website=website,
        detail_url=url,
    )
    if article_payload:
        action = _upsert_article(db, article_payload)
        clear_crawl_issues(db, [(website, tid)])
        return {
            "kind": "article",
            "action": action,
        }

    issue_payload = build_crawl_issue_payload(
        result,
        tid=tid,
        fid=fid,
        section=section,
        website=website,
        detail_url=url,
    )
    issue, action = upsert_crawl_issue(db, issue_payload)
    return {
        "kind": "issue",
        "action": action,
        "status": issue.status,
        "issue_id": issue.id,
        "issue_type": issue.issue_type,
    }


def _safe_download_name(issue_id: int, tid: int, name: str, ext: str):
    stem = Path(name or f"attachment_{issue_id}").stem
    stem = SAFE_FILENAME_PATTERN.sub("_", stem).strip("._") or f"attachment_{issue_id}"
    suffix = ext if ext.startswith(".") else f".{ext}"
    return f"issue_{issue_id}_tid_{tid}_{stem}{suffix}"


def _next_available_path(directory: Path, filename: str):
    target = directory / filename
    if not target.exists():
        return target

    stem = target.stem
    suffix = target.suffix
    counter = 1
    while True:
        candidate = directory / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def _issue_file_prefix(issue: CrawlIssue):
    return f"issue_{issue.id}_tid_{issue.tid}_"


def _list_issue_archive_files(issue: CrawlIssue, watch_path: Path):
    if not watch_path.exists():
        return []
    prefix = _issue_file_prefix(issue)
    return sorted(
        [
            item
            for item in watch_path.iterdir()
            if item.is_file()
            and item.name.startswith(prefix)
            and item.suffix.lower() in {".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".tbz2", ".iso"}
        ],
        key=lambda item: item.name,
    )


def _download_issue_attachments(
    issue: CrawlIssue,
    watch_path: Path,
    *,
    force_download: bool = False,
):
    watch_path.mkdir(parents=True, exist_ok=True)
    existing_files = _list_issue_archive_files(issue, watch_path)
    if existing_files and not force_download:
        return [str(item) for item in existing_files], False

    attachment_urls = normalize_string_list(issue.attachment_urls)
    attachment_names = normalize_string_list(issue.attachment_names)
    attachment_types = normalize_string_list(issue.attachment_types)
    if not attachment_urls:
        return [], False

    downloaded_files = []
    for index, attachment_url in enumerate(attachment_urls):
        attachment_name = (
            attachment_names[index]
            if index < len(attachment_names)
            else f"attachment_{index + 1}"
        )
        attachment_type = (
            attachment_types[index]
            if index < len(attachment_types)
            else Path(urlparse(attachment_url).path).suffix.lstrip(".") or "bin"
        )
        filename = _safe_download_name(
            issue.id,
            issue.tid,
            attachment_name,
            attachment_type,
        )
        target = _next_available_path(watch_path, filename)
        payload = sht.download_attachment_bytes(issue.detail_url or attachment_url, attachment_url)
        target.write_bytes(payload)
        downloaded_files.append(str(target))

    return downloaded_files, True


def _collect_issue_password_candidates(issue: CrawlIssue, auto_config: dict):
    values = []
    values.extend(normalize_string_list(issue.password_candidates))
    values.extend(split_password_dictionary(auto_config.get("password_dictionary")))
    return values


def _auto_process_archive_issue(
    db: Session,
    issue: CrawlIssue,
    *,
    auto_config: dict,
    force_download: bool = False,
):
    issue_handling_config = load_crawl_issue_handling_config(db)
    watch_path = Path(issue_handling_config["watch_path"])
    output_path = Path(issue_handling_config["output_path"])
    archive_path = Path(auto_config["archive_path"])

    downloaded_files, downloaded_now = _download_issue_attachments(
        issue,
        watch_path,
        force_download=force_download,
    )
    archive_files = _list_issue_archive_files(issue, watch_path)
    if not archive_files:
        issue.status = ISSUE_STATUS_FAILED
        issue.reason_code = "archive_download_missing"
        issue.reason_message = "未找到可处理的压缩包附件"
        db.flush()
        return {
            "issue_id": issue.id,
            "title": issue.title,
            "downloaded": 0,
            "extracted": 0,
            "imported": 0,
            "status": "failed",
            "message": issue.reason_message,
        }

    issue.status = ISSUE_STATUS_DOWNLOADED
    issue.reason_code = "archive_downloaded"
    issue.reason_message = f"已下载 {len(archive_files)} 个压缩包附件，准备自动解压"
    db.flush()

    password_candidates = _collect_issue_password_candidates(issue, auto_config)
    extracted_count = 0
    errors = []
    for archive_file in archive_files:
        result = extract_archive_file(
            archive_file,
            output_root=output_path,
            archive_root=archive_path,
            password_candidates=password_candidates,
            move_original=bool(auto_config.get("move_original", True)),
            delete_original=bool(auto_config.get("delete_original", False)),
        )
        if result.get("ok"):
            extracted_count += 1
            continue
        errors.append(result.get("message") or "解压失败")

    import_result = import_crawl_issue_outputs(db, issue_id=issue.id)
    import_data = import_result.get("data") or {}
    imported = int(import_data.get("imported") or 0)

    refreshed_issue = db.query(CrawlIssue).filter(CrawlIssue.id == issue.id).first()
    if imported > 0 and refreshed_issue is None:
        return {
            "issue_id": issue.id,
            "title": issue.title,
            "downloaded": len(downloaded_files) if downloaded_now else 0,
            "extracted": extracted_count,
            "imported": imported,
            "status": "resolved",
            "message": "自动下载、解压并导入成功",
        }

    if refreshed_issue:
        if extracted_count > 0 and not errors:
            refreshed_issue.status = ISSUE_STATUS_DOWNLOADED
            refreshed_issue.reason_code = "archive_extracted_no_resource"
            refreshed_issue.reason_message = "已完成解压，但暂未发现可导入资源"
        else:
            refreshed_issue.status = ISSUE_STATUS_FAILED
            refreshed_issue.reason_code = "archive_auto_extract_failed"
            refreshed_issue.reason_message = "; ".join(errors[:2]) or "自动解压失败"
        db.flush()

    return {
        "issue_id": issue.id,
        "title": issue.title,
        "downloaded": len(downloaded_files) if downloaded_now else 0,
        "extracted": extracted_count,
        "imported": imported,
        "status": "failed" if refreshed_issue and refreshed_issue.status == ISSUE_STATUS_FAILED else "pending",
        "message": refreshed_issue.reason_message if refreshed_issue else "自动处理完成",
    }


def process_crawl_issues_auto(
    db: Session,
    *,
    issue_id: int | None = None,
    trigger: str = "manual",
):
    auto_config = load_crawl_auto_extract_config(db)
    if trigger != "manual" and not auto_config.get("enabled"):
        return success(
            {
                "total": 0,
                "downloaded": 0,
                "extracted": 0,
                "imported": 0,
                "failed": 0,
                "items": [],
            },
            message="自动下载解压未开启，已跳过",
        )

    query = db.query(CrawlIssue).filter(
        CrawlIssue.issue_type == ISSUE_TYPE_ARCHIVE,
        CrawlIssue.status != ISSUE_STATUS_IGNORED,
    )
    if issue_id is not None:
        query = query.filter(CrawlIssue.id == issue_id)
    issues = query.order_by(CrawlIssue.update_time.asc(), CrawlIssue.id.asc()).all()
    if not issues:
        return success(
            {
                "total": 0,
                "downloaded": 0,
                "extracted": 0,
                "imported": 0,
                "failed": 0,
                "items": [],
            },
            message="当前没有待处理的压缩包记录",
        )

    items = []
    downloaded = 0
    extracted = 0
    imported = 0
    failed = 0
    for issue in issues:
        result = _auto_process_archive_issue(
            db,
            issue,
            auto_config=auto_config,
        )
        items.append(result)
        downloaded += int(result.get("downloaded") or 0)
        extracted += int(result.get("extracted") or 0)
        imported += int(result.get("imported") or 0)
        if result.get("status") == "failed":
            failed += 1

    message = "自动下载解压处理完成"
    if trigger == "manual":
        message = "已执行一次自动下载解压"

    return success(
        {
            "total": len(issues),
            "downloaded": downloaded,
            "extracted": extracted,
            "imported": imported,
            "failed": failed,
            "items": items,
        },
        message=message,
    )


def process_saved_archive_issues(
    db: Session,
    issues: list[CrawlIssue],
    *,
    trigger: str = "auto",
):
    auto_config = load_crawl_auto_extract_config(db)
    if not auto_config.get("enabled"):
        return []

    results = []
    for issue in issues:
        if issue.issue_type != ISSUE_TYPE_ARCHIVE:
            continue
        results.append(
            _auto_process_archive_issue(
                db,
                issue,
                auto_config=auto_config,
            )
        )
    return results


def _iter_issue_output_matches(output_path: Path, issue: CrawlIssue):
    if not output_path.exists():
        return []

    prefix = f"issue_{issue.id}_tid_{issue.tid}_"
    return [item for item in output_path.iterdir() if item.name.startswith(prefix)]


def _collect_output_resource_files(paths: list[Path]):
    files = []
    for path in paths:
        if path.is_file() and path.suffix.lower() in OUTPUT_SCAN_EXTENSIONS:
            files.append(path)
            continue

        if not path.is_dir():
            continue

        for item in path.rglob("*"):
            if item.is_file() and item.suffix.lower() in OUTPUT_SCAN_EXTENSIONS:
                files.append(item)
    return files


def _extract_issue_resources(issue: CrawlIssue, resource_files: list[Path]):
    magnet_values = []
    edk_values = []
    seen_magnets = set()
    seen_edks = set()

    for resource_file in resource_files:
        suffix = resource_file.suffix.lower()
        if suffix == ".torrent":
            magnet = sht.parse_torrent_get_magnet(
                issue.detail_url or "",
                str(resource_file),
                is_local=True,
            )
            if magnet and magnet not in seen_magnets:
                seen_magnets.add(magnet)
                magnet_values.append(magnet)
            continue

        if suffix.lstrip(".") not in TEXT_ATTACHMENT_EXTENSIONS:
            continue

        try:
            text = sht.parse_text_file(str(resource_file))
        except Exception:
            continue

        magnet = extract_magnet(text)
        if magnet and magnet not in seen_magnets:
            seen_magnets.add(magnet)
            magnet_values.append(magnet)

        edk = extract_edk(text)
        if edk and edk not in seen_edks:
            seen_edks.add(edk)
            edk_values.append(edk)

    return magnet_values, edk_values


def _build_article_from_issue(issue: CrawlIssue, magnet_values: list[str], edk_values: list[str]):
    return {
        "tid": issue.tid,
        "title": issue.title or f"tid-{issue.tid}",
        "publish_date": issue.publish_date,
        "magnet": magnet_values,
        "preview_images": normalize_string_list(issue.preview_images),
        "detail_url": issue.detail_url,
        "size": issue.size,
        "section": issue.section or "manual",
        "category": issue.category,
        "website": issue.website or "sehuatang",
        "edk": edk_values,
    }


def preview_url(url: str):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("无效的链接地址")

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
        result = sht.inspect_detail(url)
        payload = {
            "mode": "viewthread",
            "url": url,
            "runtime": runtime,
        }
        if result.get("ok") and result.get("article"):
            article = dict(result["article"])
            article["tid"] = _extract_query_value(url, "tid")
            article["detail_url"] = url
            article["website"] = parsed.netloc
            payload["article"] = article
        else:
            payload["issue"] = _serialize_preview_issue(result)
        return success(payload)

    return error("仅支持 forumdisplay 和 viewthread 链接")


def save_url(url: str, db: Session, fid: str | None = None):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("无效的链接地址")

    mod = _extract_query_value(url, "mod")
    if mod == "forumdisplay" or _extract_query_value(url, "fid"):
        target_fid = fid or _extract_query_value(url, "fid")
        if not target_fid:
            return error("forumdisplay 链接必须提供 fid")

        section_config = get_section_config(target_fid)
        section = section_config["section"]
        website = _normalize_website(url, section_config.get("website"))
        tid_list = sht.crawler_tid_list(url)
        if not tid_list:
            return error("抓取目标链接失败")

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
        issue_saved = 0
        failed_ids = []
        archive_issue_ids = []
        for tid in tid_list:
            detail_url = _build_detail_url(url, tid)
            outcome = _save_detail_url(
                db=db,
                url=detail_url,
                tid=tid,
                fid=str(target_fid),
                section=section,
                website=website,
            )
            if outcome["kind"] == "article":
                if outcome["action"] == "updated" and tid in existing_tids:
                    updated += 1
                else:
                    created += 1
                continue

            issue_saved += 1
            if outcome.get("status") == ISSUE_STATUS_FAILED:
                failed_ids.append(tid)
            if outcome.get("issue_type") == ISSUE_TYPE_ARCHIVE and outcome.get("issue_id"):
                archive_issue_ids.append(int(outcome["issue_id"]))

        auto_process_result = None
        if archive_issue_ids and load_crawl_auto_extract_config(db).get("enabled"):
            archive_issues = (
                db.query(CrawlIssue)
                .filter(CrawlIssue.id.in_(archive_issue_ids))
                .all()
            )
            auto_results = process_saved_archive_issues(db, archive_issues, trigger="save_url")
            auto_process_result = {
                "processed": len(auto_results),
                "imported": sum(int(item.get("imported") or 0) for item in auto_results),
            }

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
                "issue_saved": issue_saved,
                "failed_ids": failed_ids,
                "auto_process": auto_process_result,
            },
            message="抓取结果已保存",
        )

    if mod == "viewthread" or _extract_query_value(url, "tid"):
        tid = _extract_query_value(url, "tid")
        if not tid:
            return error("viewthread 链接必须提供 tid")

        section_config = get_section_config(fid) if fid else None
        section = section_config["section"] if section_config else "manual"
        website = _normalize_website(
            url,
            section_config.get("website") if section_config else None,
        )
        outcome = _save_detail_url(
            db=db,
            url=url,
            tid=int(tid),
            fid=fid,
            section=section,
            website=website,
        )

        auto_process_result = None
        if (
            outcome["kind"] == "issue"
            and outcome.get("issue_type") == ISSUE_TYPE_ARCHIVE
            and outcome.get("issue_id")
            and load_crawl_auto_extract_config(db).get("enabled")
        ):
            saved_issue = db.query(CrawlIssue).filter(CrawlIssue.id == outcome["issue_id"]).first()
            if saved_issue:
                results = process_saved_archive_issues(db, [saved_issue], trigger="save_url")
                auto_process_result = results[0] if results else None

        db.flush()
        return success(
            {
                "mode": "viewthread",
                "tid": int(tid),
                "section": section,
                "website": website,
                "action": outcome["action"]
                if outcome["kind"] == "article"
                else "issue_saved",
                "issue_status": outcome.get("status"),
                "issue_id": outcome.get("issue_id"),
                "auto_process": auto_process_result,
            },
            message="抓取结果已保存",
        )

    return error("仅支持 forumdisplay 和 viewthread 链接")


def list_crawl_issues(
    db: Session,
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    issue_type: str | None = None,
    keyword: str | None = None,
):
    query = db.query(CrawlIssue)

    if status and status != "all":
        query = query.filter(CrawlIssue.status == status)
    if issue_type and issue_type != "all":
        query = query.filter(CrawlIssue.issue_type == issue_type)

    if keyword:
        stripped = keyword.strip()
        if stripped:
            conditions = [
                CrawlIssue.title.ilike(f"%{stripped}%"),
                CrawlIssue.section.ilike(f"%{stripped}%"),
                CrawlIssue.reason_message.ilike(f"%{stripped}%"),
            ]
            if stripped.isdigit():
                conditions.append(CrawlIssue.tid == int(stripped))
            query = query.filter(or_(*conditions))

    summary_rows = (
        query.with_entities(CrawlIssue.status, func.count(CrawlIssue.id))
        .group_by(CrawlIssue.status)
        .all()
    )
    summary = {
        "total": 0,
        "failed": 0,
        "pending_manual": 0,
        "downloaded": 0,
        "ignored": 0,
    }
    for status_key, count in summary_rows:
        summary[str(status_key)] = int(count)
        summary["total"] += int(count)

    total = query.count()
    offset = (page - 1) * per_page
    items = (
        query.order_by(CrawlIssue.update_time.desc(), CrawlIssue.id.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return success(
        {
            "page": page,
            "per_page": per_page,
            "total": total,
            "items": [_serialize_crawl_issue(item) for item in items],
            "paths": load_crawl_issue_handling_config(db),
            "auto_extract": load_crawl_auto_extract_config(db),
            "summary": summary,
        }
    )


def retry_crawl_issue(db: Session, issue_id: int):
    issue = db.query(CrawlIssue).filter(CrawlIssue.id == issue_id).first()
    if not issue:
        return error("未找到抓取问题记录", code=404)

    result = sht.inspect_detail(issue.detail_url)
    article_payload = build_article_payload(
        result,
        tid=issue.tid,
        fid=issue.fid,
        section=issue.section,
        website=issue.website,
        detail_url=issue.detail_url,
    )
    if article_payload:
        action = _upsert_article(db, article_payload)
        db.delete(issue)
        db.flush()
        return success(
            {
                "action": action,
                "deleted_issue_id": issue_id,
            },
            message="抓取问题已解决",
        )

    issue_payload = build_crawl_issue_payload(
        result,
        tid=issue.tid,
        fid=issue.fid,
        section=issue.section,
        website=issue.website,
        detail_url=issue.detail_url,
    )
    updated_issue, _ = upsert_crawl_issue(db, issue_payload, increment_retry=True)
    auto_process_result = None
    if (
        updated_issue.issue_type == ISSUE_TYPE_ARCHIVE
        and load_crawl_auto_extract_config(db).get("enabled")
    ):
        results = process_saved_archive_issues(db, [updated_issue], trigger="retry")
        auto_process_result = results[0] if results else None
    return success(
        {
            "issue": _serialize_crawl_issue(updated_issue),
            "auto_process": auto_process_result,
        },
        message="抓取问题已更新",
    )


def ignore_crawl_issue(db: Session, issue_id: int):
    issue = db.query(CrawlIssue).filter(CrawlIssue.id == issue_id).first()
    if not issue:
        return error("未找到抓取问题记录", code=404)
    issue.status = ISSUE_STATUS_IGNORED
    db.flush()
    return success(
        {
            "issue": _serialize_crawl_issue(issue),
        },
        message="抓取问题已忽略",
    )


def download_crawl_issue(db: Session, issue_id: int):
    issue = db.query(CrawlIssue).filter(CrawlIssue.id == issue_id).first()
    if not issue:
        return error("未找到抓取问题记录", code=404)

    config = load_crawl_issue_handling_config(db)
    watch_path = Path(config["watch_path"])
    downloaded_files, _ = _download_issue_attachments(
        issue,
        watch_path,
        force_download=True,
    )
    if not downloaded_files:
        return error("当前问题没有可下载的附件链接")

    issue.status = ISSUE_STATUS_DOWNLOADED
    if issue.issue_type == ISSUE_TYPE_ARCHIVE:
        issue.reason_message = f"已下载 {len(downloaded_files)} 个压缩包附件，等待外部解压"
    auto_process_result = None
    if issue.issue_type == ISSUE_TYPE_ARCHIVE and load_crawl_auto_extract_config(db).get("enabled"):
        auto_results = process_saved_archive_issues(db, [issue], trigger="download")
        auto_process_result = auto_results[0] if auto_results else None
    db.flush()
    return success(
        {
            "downloaded_files": downloaded_files,
            "issue": _serialize_crawl_issue(issue),
            "auto_process": auto_process_result,
        },
        message="附件已下载到监控目录",
    )


def import_crawl_issue_outputs(db: Session, issue_id: int | None = None):
    config = load_crawl_issue_handling_config(db)
    output_path = Path(config["output_path"])
    query = db.query(CrawlIssue).filter(
        CrawlIssue.issue_type == ISSUE_TYPE_ARCHIVE,
        CrawlIssue.status != ISSUE_STATUS_IGNORED,
    )
    if issue_id is not None:
        query = query.filter(CrawlIssue.id == issue_id)
    issues = query.order_by(CrawlIssue.update_time.asc()).all()

    imported = 0
    deleted_issue_ids = []
    skipped = []

    for issue in issues:
        matches = _iter_issue_output_matches(output_path, issue)
        if not matches:
            skipped.append(
                {
                    "issue_id": issue.id,
                    "reason": "未找到解压输出",
                }
            )
            continue

        resource_files = _collect_output_resource_files(matches)
        magnet_values, edk_values = _extract_issue_resources(issue, resource_files)
        if not magnet_values and not edk_values:
            skipped.append(
                {
                    "issue_id": issue.id,
                    "reason": "解压输出中未发现可导入的资源",
                }
            )
            continue

        article_payload = _build_article_from_issue(issue, magnet_values, edk_values)
        _upsert_article(db, article_payload)
        deleted_issue_ids.append(issue.id)
        db.delete(issue)
        imported += 1

    db.flush()
    return success(
        {
            "imported": imported,
            "deleted_issue_ids": deleted_issue_ids,
            "skipped": skipped,
        },
        message="解压输出已扫描导入",
    )


def reset_resource_table(db: Session):
    count = db.execute(select(func.count(Article.id))).scalar() or 0
    db.execute(text("TRUNCATE TABLE sht.article RESTART IDENTITY"))
    db.flush()
    return success(
        {
            "deleted": count,
        },
        message="资源表已重置",
    )


def reset_test_space(db: Session):
    article_count = db.execute(select(func.count(Article.id))).scalar() or 0
    issue_count = db.execute(select(func.count(CrawlIssue.id))).scalar() or 0
    task_count = db.execute(select(func.count(Task.id))).scalar() or 0
    config_count = db.execute(select(func.count(Config.id))).scalar() or 0
    user_count = db.execute(select(func.count(User.id))).scalar() or 0

    db.execute(
        text(
            'TRUNCATE TABLE sht.article, sht.crawl_issue, sht.task, sht.config, sht."user" RESTART IDENTITY'
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
            "crawl_issue_deleted": issue_count,
            "task_deleted": task_count,
            "config_deleted": config_count,
            "user_deleted": user_count,
            "default_username": DEFAULT_ADMIN_USERNAME,
            "default_password": DEFAULT_ADMIN_PASSWORD,
        },
        message="test space reset",
    )
