from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.v1 import article, user, config, task
from app.core.database import Base, engine, session_scope
from app.models import Config
from app.modules.downloadclient import downloadManager
from app.scheduler import start_scheduler, scheduler
from app.utils.log import logger


def get_downloader_config():
    config_list = []
    with session_scope() as session:
        configs = session.query(Config).filter(Config.key.ilike('Downloader.%')).all()
        config_list.extend(configs)
    return config_list


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    configs = get_downloader_config()
    downloadManager.init(configs)
    # start_scheduler()
    logger.info(f"Scheduler started.")
    yield
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("Scheduler stopped.")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段先用 *
    allow_credentials=True,
    allow_methods=["*"],  # 必须包含 OPTIONS
    allow_headers=["*"],  # 必须包含 X-Token
)

app.include_router(article.router, prefix='/api/v1/articles', tags=["article"])
app.include_router(user.router, prefix='/api/v1/users', tags=["user"])
app.include_router(config.router, prefix='/api/v1/config', tags=["config"])
app.include_router(task.router, prefix='/api/v1/tasks', tags=["task"])
