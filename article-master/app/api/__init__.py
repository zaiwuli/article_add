from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.v1 import article, config, crawler, public, task, user
from app.core.database import init_database
from app.scheduler import scheduler, start_scheduler
from app.utils.log import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    if not scheduler.running:
        start_scheduler()
    logger.info("API application started.")
    yield
    if scheduler.running:
        scheduler.shutdown(wait=True)
        logger.info("Scheduler stopped.")


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router, prefix='/api/v1/public', tags=["public"])
app.include_router(article.router, prefix='/api/v1/articles', tags=["article"])
app.include_router(user.router, prefix='/api/v1/users', tags=["user"])
app.include_router(config.router, prefix='/api/v1/config', tags=["config"])
app.include_router(crawler.router, prefix='/api/v1/crawler', tags=["crawler"])
app.include_router(task.router, prefix='/api/v1/tasks', tags=["task"])
