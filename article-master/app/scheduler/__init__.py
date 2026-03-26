import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import session_scope
from app.models.task import Task
from app.scheduler.sht_sheduler import sync_sht_by_max_page, sync_sht_by_tid
from app.utils.log import logger

scheduler = AsyncIOScheduler()

TASK_FUNCTIONS = [
    {
        "func_name": "sync_sht_by_tid",
        "func_label": "Incremental crawl",
        "func_args_description": (
            'Optional JSON, e.g. {"fids":[2,36,160],"start_page":1,"max_page":100}'
        ),
    },
    {
        "func_name": "sync_sht_by_max_page",
        "func_label": "Paged crawl",
        "func_args_description": (
            'Optional JSON, e.g. {"fids":[2,36,160],"start_page":1,"max_page":5}'
        ),
    },
]

FUNC_MAP = {
    "sync_sht_by_tid": sync_sht_by_tid,
    "sync_sht_by_max_page": sync_sht_by_max_page,
}


def list_task_functions():
    return TASK_FUNCTIONS


def list_task():
    with session_scope() as session:
        tasks = session.query(Task).filter(Task.enable == True).all()
    return tasks


def push_job():
    tasks = list_task()
    for task in tasks:
        if task.task_func not in FUNC_MAP:
            logger.warning(f"skip unsupported task function: {task.task_func}")
            continue

        try:
            kwargs = {}
            if task.task_args:
                kwargs = json.loads(task.task_args)
            scheduler.add_job(
                FUNC_MAP[task.task_func],
                kwargs=kwargs,
                trigger=CronTrigger.from_crontab(expr=task.task_cron),
            )
        except Exception as exc:
            logger.warning(f"skip invalid task {task.id}: {exc}")


def start_scheduler():
    push_job()
    scheduler.start()


def restart_scheduler():
    scheduler.remove_all_jobs()
    push_job()
