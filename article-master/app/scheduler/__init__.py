import json

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import session_scope
from app.models.task import Task
from app.utils.log import logger, transfer_logger

scheduler = AsyncIOScheduler()

TRANSFER_JOB_ID = "article_transfer_schedule"
CRAWLER_AUTO_EXTRACT_JOB_ID = "crawler_auto_extract_schedule"


def _load_task_registry():
    from app.scheduler.sht_sheduler import (
        sync_crawl_issue_outputs,
        sync_sht_by_max_page,
        sync_sht_by_tid,
    )

    task_functions = [
        {
            "func_name": "sync_sht_by_tid",
            "func_label": "按最新帖子增量抓取",
            "func_args_description": (
                '示例 JSON: {"fids":["2","36","160"],"start_page":1,"max_page":100}'
            ),
        },
        {
            "func_name": "sync_sht_by_max_page",
            "func_label": "按页数批量抓取",
            "func_args_description": (
                '示例 JSON: {"fids":["2","36","160"],"start_page":1,"max_page":5}'
            ),
        },
        {
            "func_name": "sync_crawl_issue_outputs",
            "func_label": "扫描解压输出并导入",
            "func_args_description": (
                "无需额外参数，扫描 output_path 并导入 txt/torrent/nfo 结果。"
            ),
        },
    ]
    func_map = {
        "sync_sht_by_tid": sync_sht_by_tid,
        "sync_sht_by_max_page": sync_sht_by_max_page,
        "sync_crawl_issue_outputs": sync_crawl_issue_outputs,
    }
    return task_functions, func_map


def list_task_functions():
    task_functions, _ = _load_task_registry()
    return task_functions


def get_func_map():
    _, func_map = _load_task_registry()
    return func_map


def list_task():
    with session_scope() as session:
        tasks = session.query(Task).filter(Task.enable == True).all()
    return tasks


def run_transfer_job():
    from app.api.services import transfer_service

    transfer_logger.info("scheduled transfer job triggered")
    with session_scope() as session:
        transfer_service.transfer_articles(session, trigger="schedule")


def run_crawler_auto_extract_job():
    from app.api.services import crawler_service

    logger.info("自动下载解压定时任务开始执行")
    with session_scope() as session:
        crawler_service.process_crawl_issues_auto(session, trigger="schedule")


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


def push_crawler_auto_extract_job():
    from app.api.services.config_service import (
        CRAWLER_AUTO_EXTRACT_CONFIG_KEY,
        get_default_crawler_auto_extract_config,
        load_config_payload,
    )

    with session_scope() as session:
        payload = load_config_payload(CRAWLER_AUTO_EXTRACT_CONFIG_KEY, session)

    config = get_default_crawler_auto_extract_config()
    if isinstance(payload, dict):
        config.update(payload)

    if not config.get("enabled"):
        logger.info("自动下载解压未开启，跳过注册定时任务")
        return
    if not config.get("schedule_enabled"):
        logger.info("自动下载解压定时开关未开启")
        return

    cron_expr = str(config.get("schedule_cron", "")).strip()
    if not cron_expr:
        logger.warning("自动下载解压的 Cron 表达式为空，跳过注册")
        return

    try:
        scheduler.add_job(
            run_crawler_auto_extract_job,
            id=CRAWLER_AUTO_EXTRACT_JOB_ID,
            replace_existing=True,
            trigger=CronTrigger.from_crontab(expr=cron_expr),
        )
        logger.info(f"自动下载解压定时任务已注册: cron={cron_expr}")
    except Exception as exc:
        logger.warning(f"自动下载解压定时任务注册失败: {exc}")


def push_job():
    _, func_map = _load_task_registry()
    tasks = list_task()
    for task in tasks:
        if task.task_func not in func_map:
            logger.warning(f"skip unsupported task function: {task.task_func}")
            continue

        try:
            kwargs = {}
            if task.task_args:
                kwargs = json.loads(task.task_args)
            scheduler.add_job(
                func_map[task.task_func],
                kwargs=kwargs,
                trigger=CronTrigger.from_crontab(expr=task.task_cron),
            )
        except Exception as exc:
            logger.warning(f"skip invalid task {task.id}: {exc}")

    push_transfer_job()
    push_crawler_auto_extract_job()


def start_scheduler():
    push_job()
    scheduler.start()


def restart_scheduler():
    scheduler.remove_all_jobs()
    push_job()
