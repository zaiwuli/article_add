import json
import os

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.core import settings
from app.core.config import data_path
from app.models import Config
from app.schemas.response import error
from app.schemas.config import JsonPayload
from app.schemas.response import success

CRAWLER_SECTION_CONFIG_KEY = "CrawlerSections"
CRAWLER_RUNTIME_CONFIG_KEY = "CrawlerRuntime"
PUBLIC_ARTICLE_API_CONFIG_KEY = "PublicArticleApi"
ARTICLE_TRANSFER_TARGET_CONFIG_KEY = "ArticleTransferTarget"
CRAWLER_ISSUE_HANDLING_CONFIG_KEY = "CrawlerIssueHandling"
CRAWLER_AUTO_EXTRACT_CONFIG_KEY = "CrawlerAutoExtract"


def get_default_public_article_api_config():
    return {
        "enabled": True,
    }


def get_default_transfer_target_config():
    return {
        "host": "",
        "port": 5432,
        "database": "",
        "username": "",
        "password": "",
        "schema": "public",
        "table": "",
        "schedule_enabled": False,
        "schedule_cron": "0 2 * * *",
    }


def get_default_crawler_issue_handling_config():
    return {
        "watch_path": os.path.join(data_path, "crawl_watch"),
        "output_path": os.path.join(data_path, "crawl_output"),
    }


def get_default_crawler_auto_extract_config():
    return {
        "enabled": False,
        "schedule_enabled": False,
        "schedule_cron": "*/10 * * * *",
        "archive_path": os.path.join(data_path, "crawl_archive"),
        "move_original": True,
        "delete_original": False,
        "password_dictionary": "",
    }


def _normalize_crawler_sections_payload(payload):
    if not isinstance(payload, list):
        return []
    sections = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        fid = str(item.get("fid", "")).strip()
        if not fid:
            continue
        sections.append(
            {
                "fid": fid,
                "section": str(item.get("section", "")).strip(),
                "website": str(item.get("website", "") or "sehuatang").strip(),
            }
        )
    return sections


def _normalize_crawler_runtime_payload(payload):
    data = {
        "proxy": "",
        "flare_solver_url": "",
    }
    if isinstance(payload, dict):
        data.update(payload)
    data["proxy"] = str(data.get("proxy", "") or "").strip()
    data["flare_solver_url"] = str(data.get("flare_solver_url", "") or "").strip()
    return data


def _normalize_crawler_issue_handling_payload(payload):
    data = get_default_crawler_issue_handling_config()
    if isinstance(payload, dict):
        data.update(payload)
    data["watch_path"] = str(data.get("watch_path", "") or "").strip()
    data["output_path"] = str(data.get("output_path", "") or "").strip()
    return data


def _normalize_public_article_api_payload(payload):
    data = get_default_public_article_api_config()
    if isinstance(payload, dict):
        data.update(payload)
    data["enabled"] = bool(data.get("enabled", True))
    return data


def _normalize_crawler_auto_extract_payload(payload):
    data = get_default_crawler_auto_extract_config()
    if isinstance(payload, dict):
        data.update(payload)
    data["enabled"] = bool(data.get("enabled", False))
    data["schedule_enabled"] = bool(data.get("schedule_enabled", False))
    data["schedule_cron"] = str(
        data.get("schedule_cron", get_default_crawler_auto_extract_config()["schedule_cron"])
    ).strip()
    data["archive_path"] = str(
        data.get("archive_path", get_default_crawler_auto_extract_config()["archive_path"])
        or get_default_crawler_auto_extract_config()["archive_path"]
    ).strip()
    data["move_original"] = bool(data.get("move_original", True))
    data["delete_original"] = bool(data.get("delete_original", False))
    if data["delete_original"]:
        data["move_original"] = False
    data["password_dictionary"] = str(data.get("password_dictionary", "") or "").strip()
    return data


def _load_config_record(key: str, db: Session):
    return db.query(Config).filter(Config.key == key).first()


def load_config_payload(key: str, db: Session):
    config = _load_config_record(key, db)
    if not config or not config.content:
        return None

    return json.loads(str(config.content))


def save_option(json_payload: JsonPayload, db: Session):
    key = json_payload.key
    payload = json_payload.payload

    restart_scheduler_required = False
    if key == CRAWLER_SECTION_CONFIG_KEY:
        payload = _normalize_crawler_sections_payload(payload)
    elif key == CRAWLER_RUNTIME_CONFIG_KEY:
        payload = _normalize_crawler_runtime_payload(payload)
    elif key == CRAWLER_ISSUE_HANDLING_CONFIG_KEY:
        payload = _normalize_crawler_issue_handling_payload(payload)
        if not payload["watch_path"]:
            return error("监控目录不能为空")
        if not payload["output_path"]:
            return error("解压输出目录不能为空")
    elif key == PUBLIC_ARTICLE_API_CONFIG_KEY:
        payload = _normalize_public_article_api_payload(payload)
    elif key == CRAWLER_AUTO_EXTRACT_CONFIG_KEY:
        payload = _normalize_crawler_auto_extract_payload(payload)
        if payload["schedule_enabled"]:
            try:
                CronTrigger.from_crontab(payload["schedule_cron"])
            except ValueError as exc:
                return error(f"Cron 表达式无效: {exc}")
        restart_scheduler_required = True

    config = _load_config_record(key, db)
    content = json.dumps(payload, ensure_ascii=False)
    if config is None:
        config = Config()
        config.key = key
        config.content = content
        db.add(config)
    else:
        config.content = content
    db.flush()

    if restart_scheduler_required:
        db.commit()
        from app.scheduler import restart_scheduler

        restart_scheduler()
    return success()


def is_public_article_api_enabled(db: Session) -> bool:
    payload = load_config_payload(PUBLIC_ARTICLE_API_CONFIG_KEY, db)
    if not isinstance(payload, dict):
        return True
    return bool(payload.get("enabled", True))


def get_option(key, db: Session):
    if key == "TaskFunction":
        from app.scheduler import list_task_functions

        return success(list_task_functions())

    if key == CRAWLER_SECTION_CONFIG_KEY:
        from app.scheduler.sht_section_registry import list_section_configs

        return success(list_section_configs())

    if key == CRAWLER_RUNTIME_CONFIG_KEY:
        config = _load_config_record(key, db)
        data = {
            "proxy": settings.PROXY or "",
            "flare_solver_url": settings.FLARE_SOLVERR_URL or "",
        }
        if config:
            payload = json.loads(str(config.content))
            if isinstance(payload, dict):
                if "proxy" in payload:
                    data["proxy"] = payload.get("proxy") or ""
                if "flare_solver_url" in payload:
                    data["flare_solver_url"] = payload.get("flare_solver_url") or ""
        return success(data)

    if key == PUBLIC_ARTICLE_API_CONFIG_KEY:
        payload = load_config_payload(key, db)
        if isinstance(payload, dict):
            data = get_default_public_article_api_config()
            data.update(payload)
            return success(data)
        return success(get_default_public_article_api_config())

    if key == ARTICLE_TRANSFER_TARGET_CONFIG_KEY:
        payload = load_config_payload(key, db)
        if isinstance(payload, dict):
            data = get_default_transfer_target_config()
            data.update(payload)
            return success(data)
        return success(get_default_transfer_target_config())

    if key == CRAWLER_ISSUE_HANDLING_CONFIG_KEY:
        payload = load_config_payload(key, db)
        if isinstance(payload, dict):
            data = get_default_crawler_issue_handling_config()
            data.update(payload)
            return success(data)
        return success(get_default_crawler_issue_handling_config())

    if key == CRAWLER_AUTO_EXTRACT_CONFIG_KEY:
        payload = load_config_payload(key, db)
        if isinstance(payload, dict):
            return success(_normalize_crawler_auto_extract_payload(payload))
        return success(get_default_crawler_auto_extract_config())

    config = _load_config_record(key, db)
    if config:
        data = json.loads(str(config.content))
        return success(data)
    return success()
