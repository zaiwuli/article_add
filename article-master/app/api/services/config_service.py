import json

from sqlalchemy.orm import Session

from app.enum import DownloadClientEnum
from app.models import Config
from app.modules.downloadclient import downloadManager
from app.schemas.config import JsonPayload
from app.schemas.response import success, error

DEFAULT_OPTIONS = {
    "TaskFunction": [
        {
            "func_name": "sync_sht_by_tid",
            "func_label": "Incremental crawl",
            "func_args_description": (
                'Optional JSON, e.g. {"fids":[2,36,160],"start_page":1,"max_page":100}'
            ),
        },
        {
            "func_name": "sync_sht_by_max_page",
            "func_label": "Paged crawl",
            "func_args_description": (
                'Optional JSON, e.g. {"fids":[2,36,160],"start_page":1,"max_page":5}'
            ),
        },
    ]
}


def save_option(json_payload: JsonPayload, db: Session):
    key = json_payload.key
    config = db.query(Config).filter(Config.key == key).first()
    if config is None:
        config = Config()
        config.key = key
        config.content = json.dumps(json_payload.payload)
        db.add(config)
    else:
        config.content = json.dumps(json_payload.payload)
    if json_payload.key in [item.value for item in DownloadClientEnum]:
        downloadManager.reload(json_payload.key, json_payload.payload)
    return success()


def get_option(key, db: Session):
    config = db.query(Config).filter(Config.key == key).first()
    if config:
        data = json.loads(str(config.content))
        return success(data)
    if key in DEFAULT_OPTIONS:
        return success(DEFAULT_OPTIONS[key])
    return success()
