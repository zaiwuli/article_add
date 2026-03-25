import json
import os
from typing import Dict, Iterable, List, Optional

from app.core.config import data_path
from app.utils.log import logger

DEFAULT_WEBSITE = "sehuatang"
SECTION_CONFIG_FILE = os.path.join(data_path, "sht_sections.json")
DEFAULT_SHT_SECTIONS = [
    {"fid": "2", "section": "\u56fd\u4ea7\u539f\u521b", "website": DEFAULT_WEBSITE},
    {"fid": "36", "section": "\u4e9a\u6d32\u65e0\u7801\u539f\u521b", "website": DEFAULT_WEBSITE},
    {"fid": "37", "section": "\u4e9a\u6d32\u6709\u7801\u539f\u521b", "website": DEFAULT_WEBSITE},
    {"fid": "38", "section": "\u6b27\u7f8e\u65e0\u7801", "website": DEFAULT_WEBSITE},
    {"fid": "39", "section": "\u52a8\u6f2b\u539f\u521b", "website": DEFAULT_WEBSITE},
    {"fid": "103", "section": "\u9ad8\u6e05\u4e2d\u6587\u5b57\u5e55", "website": DEFAULT_WEBSITE},
    {"fid": "104", "section": "\u7d20\u4eba\u6709\u7801\u7cfb\u5217", "website": DEFAULT_WEBSITE},
    {"fid": "107", "section": "\u4e09\u7ea7\u5199\u771f", "website": DEFAULT_WEBSITE},
    {"fid": "151", "section": "4K\u539f\u7248", "website": DEFAULT_WEBSITE},
    {"fid": "152", "section": "\u97e9\u56fd\u4e3b\u64ad", "website": DEFAULT_WEBSITE},
    {"fid": "160", "section": "VR\u89c6\u9891\u533a", "website": DEFAULT_WEBSITE},
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


def load_section_registry() -> Dict[str, Dict[str, str]]:
    registry = {
        item["fid"]: build_section_config(
            item["fid"],
            item.get("section"),
            item.get("website"),
        )
        for item in DEFAULT_SHT_SECTIONS
    }

    if not os.path.exists(SECTION_CONFIG_FILE):
        return registry

    try:
        with open(SECTION_CONFIG_FILE, "r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(f"failed to load section config: {exc}")
        return registry

    items = []
    if isinstance(payload, dict):
        items = [
            build_section_config(
                fid,
                section if isinstance(section, str) else None,
            )
            for fid, section in payload.items()
        ]
    elif isinstance(payload, list):
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
    else:
        logger.warning(
            f"unsupported section config format: {type(payload).__name__}"
        )
        return registry

    for item in items:
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


def get_section_config(fid) -> Dict[str, str]:
    registry = load_section_registry()
    normalized_fid = normalize_fid(fid)
    return registry.get(normalized_fid, build_section_config(normalized_fid))


def get_section_configs(fids: Optional[Iterable] = None) -> List[Dict[str, str]]:
    registry = load_section_registry()
    parsed_fids = parse_fids(fids)
    if not parsed_fids:
        return list(registry.values())
    return [registry.get(fid, build_section_config(fid)) for fid in parsed_fids]
