from datetime import date, datetime
from typing import Dict

from sqlalchemy import BigInteger, Column, Date, DateTime, Integer, String, Text, UniqueConstraint, func

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
    title: str = Column(String(255), nullable=False)
    publish_date: date = Column(Date)
    magnet: str = Column(Text, nullable=False)
    preview_images: str = Column(Text)
    detail_url: str = Column(String(255))
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
    edk: str = Column(Text)

    def __init__(self, data: Dict):
        dict_trans_obj(data, self)
