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


def save_option(json_payload: JsonPayload, db: Session):
    key = json_payload.key
    config = db.query(Config).filter(Config.key == key).first()
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


def get_option(key, db: Session):
    if key == "TaskFunction":
        return success(list_task_functions())

    if key == CRAWLER_SECTION_CONFIG_KEY:
        return success(list_section_configs())

    if key == CRAWLER_RUNTIME_CONFIG_KEY:
        config = db.query(Config).filter(Config.key == key).first()
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

    config = db.query(Config).filter(Config.key == key).first()
    if config:
        data = json.loads(str(config.content))
        return success(data)
    return success()
