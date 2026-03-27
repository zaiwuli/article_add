from datetime import date, datetime
from typing import Dict

from sqlalchemy import BigInteger, Column, Date, DateTime, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base
from app.utils import dict_trans_obj


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
    magnet: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    edk: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    preview_images: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    archive_attachment_urls: list[str] = Column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    archive_attachment_names: list[str] = Column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    archive_parse_status: str = Column(Text, nullable=False, server_default="none")
    detail_url: str = Column(Text)
    size: int = Column(Integer())
    section: str = Column(Text, nullable=False)
    category: str = Column(Text)
    website: str = Column(Text, nullable=False, server_default="sehuatang")
    create_time: datetime = Column(DateTime(timezone=True), server_default=func.now())
    update_time: datetime = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __init__(self, data: Dict):
        dict_trans_obj(data, self)
