from pydantic import BaseModel, Field


class TransferTargetPayload(BaseModel):
    host: str = ""
    port: int = Field(default=5432, ge=1)
    database: str = ""
    username: str = ""
    password: str = ""
    schema: str = "public"
    table: str = ""
    schedule_enabled: bool = False
    schedule_cron: str = "0 2 * * *"


class TransferTableLookupPayload(BaseModel):
    host: str = ""
    port: int = Field(default=5432, ge=1)
    database: str = ""
    username: str = ""
    password: str = ""
    schema: str = "public"
