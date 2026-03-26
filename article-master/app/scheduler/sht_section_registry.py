import json
import os
from typing import Dict, Iterable, List, Optional

from app.core.config import data_path
from app.core.database import session_scope
from app.models import Config
from app.utils.log import logger

CRAWLER_SECTION_CONFIG_KEY = "CrawlerSections"
DEFAULT_WEBSITE = "sehuatang"
SECTION_CONFIG_FILE = os.path.join(data_path, "sht_sections.json")
DEFAULT_SHT_SECTIONS = [
    {"fid": "2", "section": "国产原创", "website": DEFAULT_WEBSITE},
    {"fid": "36", "section": "亚洲无码原创", "website": DEFAULT_WEBSITE},
    {"fid": "37", "section": "亚洲有码原创", "website": DEFAULT_WEBSITE},
    {"fid": "38", "section": "欧美无码", "website": DEFAULT_WEBSITE},
    {"fid": "39", "section": "动漫原创", "website": DEFAULT_WEBSITE},
    {"fid": "103", "section": "高清中文字幕", "website": DEFAULT_WEBSITE},
    {"fid": "104", "section": "素人有码系列", "website": DEFAULT_WEBSITE},
    {"fid": "107", "section": "三级写真", "website": DEFAULT_WEBSITE},
    {"fid": "151", "section": "4K原版", "website": DEFAULT_WEBSITE},
    {"fid": "152", "section": "韩国主播", "website": DEFAULT_WEBSITE},
    {"fid": "160", "section": "VR视频区", "website": DEFAULT_WEBSITE},
]


def normalize_fid(fid) -> str:
    return str(fid).strip()


def build_section_config(
    fid,
    section: Optional[str] = None,
    website: Optional[str] = None,
):
    normalized_fid = normalize_fid(fid)
    return {
        "fid": normalized_fid,
        "section": section or f"forum-{normalized_fid}",
        "website": website or DEFAULT_WEBSITE,
    }


def normalize_section_items(payload) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    if isinstance(payload, dict):
        for fid, section in payload.items():
            if isinstance(section, dict):
                items.append(
                    build_section_config(
                        fid,
                        section.get("section"),
                        section.get("website"),
                    )
                )
                continue
            items.append(
                build_section_config(
                    fid,
                    section if isinstance(section, str) else None,
                )
            )
        return items

    if not isinstance(payload, list):
        return items

    for item in payload:
        if not isinstance(item, dict) or "fid" not in item:
            continue
        items.append(
            build_section_config(
                item["fid"],
                item.get("section"),
                item.get("website"),
            )
        )
    return items


def load_file_section_items() -> List[Dict[str, str]]:
    if not os.path.exists(SECTION_CONFIG_FILE):
        return []

    try:
        with open(SECTION_CONFIG_FILE, "r", encoding="utf-8") as file:
            payload = json.load(file)
        return normalize_section_items(payload)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(f"failed to load section config file: {exc}")
        return []


def load_db_section_items() -> List[Dict[str, str]]:
    try:
        with session_scope() as session:
            config = (
                session.query(Config)
                .filter(Config.key == CRAWLER_SECTION_CONFIG_KEY)
                .first()
            )
        if not config or not config.content:
            return []
        payload = json.loads(str(config.content))
        return normalize_section_items(payload)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(f"failed to load crawler sections from db: {exc}")
        return []


def load_section_registry() -> Dict[str, Dict[str, str]]:
    registry = {
        item["fid"]: build_section_config(
            item["fid"],
            item.get("section"),
            item.get("website"),
        )
        for item in DEFAULT_SHT_SECTIONS
    }

    for item in load_file_section_items():
        registry[item["fid"]] = item

    for item in load_db_section_items():
        registry[item["fid"]] = item

    return registry


def parse_fids(fids: Optional[Iterable]) -> List[str]:
    if fids is None:
        return []

    if isinstance(fids, str):
        raw_items = fids.split(",")
    else:
        raw_items = list(fids)

    parsed = []
    seen = set()
    for item in raw_items:
        fid = normalize_fid(item)
        if not fid or fid in seen:
            continue
        seen.add(fid)
        parsed.append(fid)
    return parsed


def sort_section_items(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    def sort_key(item):
        fid = item["fid"]
        return (0, int(fid)) if fid.isdigit() else (1, fid)

    return sorted(items, key=sort_key)


def list_section_configs() -> List[Dict[str, str]]:
    return sort_section_items(list(load_section_registry().values()))


def get_section_config(fid) -> Dict[str, str]:
    registry = load_section_registry()
    normalized_fid = normalize_fid(fid)
    return registry.get(normalized_fid, build_section_config(normalized_fid))


def get_section_configs(fids: Optional[Iterable] = None) -> List[Dict[str, str]]:
    registry = load_section_registry()
    parsed_fids = parse_fids(fids)
    if not parsed_fids:
        return sort_section_items(list(registry.values()))
    return [registry.get(fid, build_section_config(fid)) for fid in parsed_fids]
