from datetime import date, datetime
from typing import Any, Dict

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base
from app.utils import dict_trans_obj


def _normalize_text_array(value: Any, *, split_commas: bool = False) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        if split_commas:
            return [item.strip() for item in raw.split(",") if item.strip()]
        return [raw]

    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]

    return [str(value).strip()]


class Article(Base):
    __tablename__ = "article"
    __table_args__ = (
        UniqueConstraint("website", "tid", name="uq_article_website_tid"),
        {"schema": "sht"},
    )

    id: int = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    tid: int = Column(Integer, nullable=False, index=True)
    title: str = Column(Text, nullable=False)
    publish_date: date = Column(Date)
    magnet: list[str] = Column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    preview_images: list[str] = Column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )
    detail_url: str = Column(Text)
    size: int = Column(Integer())
    section: str = Column(String(255), nullable=False)
    category: str = Column(String(255))
    website: str = Column(String(64), nullable=False, server_default="sehuatang")
    create_time: datetime = Column(DateTime(timezone=True), server_default=func.now())
    update_time: datetime = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    edk: list[str] = Column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'::text[]"),
    )

    def __init__(self, data: Dict):
        normalized = dict(data or {})
        normalized["magnet"] = _normalize_text_array(normalized.get("magnet"))
        normalized["preview_images"] = _normalize_text_array(
            normalized.get("preview_images"),
            split_commas=True,
        )
        normalized["edk"] = _normalize_text_array(normalized.get("edk"))
        dict_trans_obj(normalized, self)
