import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import session_scope
from app.models.task import Task
from app.scheduler.sht_sheduler import sync_sht_by_max_page, sync_sht_by_tid
from app.utils.log import logger, transfer_logger

scheduler = AsyncIOScheduler()

TASK_FUNCTIONS = [
    {
        "func_name": "sync_sht_by_tid",
        "func_label": "按最新帖子增量抓取",
        "func_args_description": (
            '图形化参数会自动生成 JSON，例如 {"fids":["2","36","160"],"start_page":1,"max_page":100}'
        ),
    },
    {
        "func_name": "sync_sht_by_max_page",
        "func_label": "按页数批量抓取",
        "func_args_description": (
            '图形化参数会自动生成 JSON，例如 {"fids":["2","36","160"],"start_page":1,"max_page":5}'
        ),
    },
]

FUNC_MAP = {
    "sync_sht_by_tid": sync_sht_by_tid,
    "sync_sht_by_max_page": sync_sht_by_max_page,
}

TRANSFER_JOB_ID = "article_transfer_schedule"


def list_task_functions():
    return TASK_FUNCTIONS


def list_task():
    with session_scope() as session:
        tasks = session.query(Task).filter(Task.enable == True).all()
    return tasks


def run_transfer_job():
    from app.api.services import transfer_service

    transfer_logger.info("scheduled transfer job triggered")
    with session_scope() as session:
        transfer_service.transfer_articles(session, trigger="schedule")


def push_transfer_job():
    from app.api.services.config_service import (
        ARTICLE_TRANSFER_TARGET_CONFIG_KEY,
        get_default_transfer_target_config,
        load_config_payload,
    )

    with session_scope() as session:
        payload = load_config_payload(ARTICLE_TRANSFER_TARGET_CONFIG_KEY, session)

    config = get_default_transfer_target_config()
    if isinstance(payload, dict):
        config.update(payload)

    if not config.get("schedule_enabled"):
        transfer_logger.info("transfer schedule is disabled")
        return

    cron_expr = str(config.get("schedule_cron", "")).strip()
    if not cron_expr:
        transfer_logger.warning("skip transfer schedule because schedule_cron is empty")
        return

    try:
        scheduler.add_job(
            run_transfer_job,
            id=TRANSFER_JOB_ID,
            replace_existing=True,
            trigger=CronTrigger.from_crontab(expr=cron_expr),
        )
        transfer_logger.info(f"transfer schedule registered with cron={cron_expr}")
    except Exception as exc:
        transfer_logger.warning(f"skip invalid transfer schedule: {exc}")


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

    push_transfer_job()


def start_scheduler():
    push_job()
    scheduler.start()


def restart_scheduler():
    scheduler.remove_all_jobs()
    push_job()
