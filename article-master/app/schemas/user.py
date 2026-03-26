from pydantic import BaseModel, Field


class UserPayload(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=8, max_length=128)
