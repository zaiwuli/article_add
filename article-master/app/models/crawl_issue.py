from datetime import date, datetime
from typing import Dict

from sqlalchemy import BigInteger, Column, Date, DateTime, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY

from app.core.database import Base
from app.utils import dict_trans_obj


class CrawlIssue(Base):
    __tablename__ = "crawl_issue"
    __table_args__ = (
        UniqueConstraint("website", "tid", name="uq_crawl_issue_website_tid"),
        {"schema": "sht"},
    )

    id: int = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    tid: int = Column(Integer, nullable=False, index=True)
    fid: str = Column(Text)
    title: str = Column(Text)
    publish_date: date = Column(Date)
    preview_images: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    detail_url: str = Column(Text)
    size: int = Column(Integer())
    section: str = Column(Text, nullable=False, server_default="manual")
    category: str = Column(Text)
    website: str = Column(Text, nullable=False, server_default="sehuatang")
    status: str = Column(Text, nullable=False, server_default="failed")
    issue_type: str = Column(Text, nullable=False, server_default="resource_missing")
    stage: str = Column(Text)
    reason_code: str = Column(Text)
    reason_message: str = Column(Text)
    attachment_urls: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    attachment_names: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    attachment_types: list[str] = Column(ARRAY(Text), nullable=False, server_default="{}")
    retry_count: int = Column(Integer, nullable=False, server_default="0")
    create_time: datetime = Column(DateTime(timezone=True), server_default=func.now())
    update_time: datetime = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __init__(self, data: Dict):
        dict_trans_obj(data, self)
