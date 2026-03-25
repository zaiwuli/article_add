import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import session_scope
from app.models.task import Task
from app.scheduler.sht_sheduler import sync_sht_by_tid, sync_sht_by_max_page

scheduler = AsyncIOScheduler()

FUNC_MAP = {
    "sync_sht_by_tid": sync_sht_by_tid,
    "sync_sht_by_max_page": sync_sht_by_max_page,
}


def list_task():
    with session_scope() as session:
        tasks = session.query(Task).filter(Task.enable == True).all()
    return tasks


def push_job():
    tasks = list_task()
    for task in tasks:
        args = task.task_args
        kwargs = {}
        if args:
            kwargs = json.loads(args)
        scheduler.add_job(FUNC_MAP[task.task_func], kwargs=kwargs,
                          trigger=CronTrigger.from_crontab(expr=task.task_cron))


def start_scheduler():
    push_job()
    scheduler.start()


def restart_scheduler():
    scheduler.remove_all_jobs()
    push_job()
