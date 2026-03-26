from pydantic import BaseModel, Field


class CrawlerPreviewPayload(BaseModel):
    url: str = Field(min_length=1)


class CrawlerSavePayload(BaseModel):
    url: str = Field(min_length=1)
    fid: str | None = None


class TransferTablePayload(BaseModel):
    database_url: str = Field(min_length=1)


class TransferArticlePayload(BaseModel):
    database_url: str = Field(min_length=1)
    table_name: str = Field(min_length=1)
