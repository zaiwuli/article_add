from pydantic import BaseModel, Field


class CrawlerPreviewPayload(BaseModel):
    url: str = Field(min_length=1)


class CrawlerSavePayload(BaseModel):
    url: str = Field(min_length=1)
    fid: str | None = None
