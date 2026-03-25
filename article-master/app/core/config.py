import os
from pathlib import Path

from pydantic.v1 import BaseSettings

root_path = '/' if os.environ.get('DOCKER_ENV') else os.path.dirname(Path(__file__).resolve().parent.parent)
data_path = os.path.join(root_path, 'data')
env_path = os.path.join(data_path, 'app.env')


class Settings(BaseSettings):
    DATABASE_URL: str | None
    PROXY: str | None
    FLARE_SOLVERR_URL: str | None

    class Config:
        env_file = os.path.join(env_path)
