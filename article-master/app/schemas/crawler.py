from pydantic import BaseModel, Field


class CrawlerPreviewPayload(BaseModel):
    url: str = Field(min_length=1)
