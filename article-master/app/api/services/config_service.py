import json

from sqlalchemy.orm import Session

from app.core import settings
from app.models import Config
from app.scheduler import list_task_functions
from app.scheduler.sht_section_registry import list_section_configs
from app.schemas.config import JsonPayload
from app.schemas.response import success

CRAWLER_SECTION_CONFIG_KEY = "CrawlerSections"
CRAWLER_RUNTIME_CONFIG_KEY = "CrawlerRuntime"
PUBLIC_ARTICLE_API_CONFIG_KEY = "PublicArticleApi"
ARTICLE_TRANSFER_TARGET_CONFIG_KEY = "ArticleTransferTarget"


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
    }


def _load_config_record(key: str, db: Session):
    return db.query(Config).filter(Config.key == key).first()


def load_config_payload(key: str, db: Session):
    config = _load_config_record(key, db)
    if not config or not config.content:
        return None

    return json.loads(str(config.content))


def save_option(json_payload: JsonPayload, db: Session):
    key = json_payload.key
    config = _load_config_record(key, db)
    content = json.dumps(json_payload.payload)
    if config is None:
        config = Config()
        config.key = key
        config.content = content
        db.add(config)
    else:
        config.content = content
    db.flush()
    return success()


def is_public_article_api_enabled(db: Session) -> bool:
    payload = load_config_payload(PUBLIC_ARTICLE_API_CONFIG_KEY, db)
    if not isinstance(payload, dict):
        return True
    return bool(payload.get("enabled", True))


def get_option(key, db: Session):
    if key == "TaskFunction":
        return success(list_task_functions())

    if key == CRAWLER_SECTION_CONFIG_KEY:
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

    config = _load_config_record(key, db)
    if config:
        data = json.loads(str(config.content))
        return success(data)
    return success()
