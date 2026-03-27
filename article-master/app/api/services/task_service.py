import json
import threading

from sqlalchemy.orm import Session

from app.models.task import Task
from app.scheduler import (
    get_func_map,
    list_task_functions as get_task_functions,
    restart_scheduler,
)
from app.schemas.response import error, success
from app.schemas.task import TaskForm


def list_task(db: Session):
    task_list = db.query(Task).all()
    return success(task_list)


def list_task_functions():
    return success(get_task_functions())


def add_task(db: Session, task_form: TaskForm):
    func_map = get_func_map()
    if task_form.task_func not in func_map:
        return error("task function is not supported")
    if task_form.task_args:
        try:
            json.loads(str(task_form.task_args))
        except json.JSONDecodeError:
            return error("task args must be valid json")
    task = Task(**task_form.model_dump(exclude={"id"}))
    db.add(task)
    db.flush()
    db.commit()
    restart_scheduler()
    return success(task)


def update_task(db: Session, task_form: TaskForm):
    func_map = get_func_map()
    if task_form.task_func not in func_map:
        return error("task function is not supported")
    if task_form.task_args:
        try:
            json.loads(str(task_form.task_args))
        except json.JSONDecodeError:
            return error("task args must be valid json")
    task = db.query(Task).filter_by(id=task_form.id).first()
    if task:
        task.task_name = task_form.task_name
        task.task_func = task_form.task_func
        task.task_args = task_form.task_args
        task.task_cron = task_form.task_cron
        task.enable = task_form.enable
        db.commit()
        db.flush()
        restart_scheduler()
    return success(task)


def delete_task(db: Session, task_id):
    task = db.get(Task, task_id)
    if task:
        db.delete(task)
        db.commit()
        restart_scheduler()
    return success()


def run_task(db: Session, task_id: int):
    func_map = get_func_map()
    task = db.get(Task, task_id)
    if not task:
        return error("task not found")
    if task.task_func not in func_map:
        return error("task function is not supported")

    kwargs = {}
    if task.task_args:
        try:
            kwargs = json.loads(str(task.task_args))
        except json.JSONDecodeError:
            return error("task args must be valid json")
    threading.Thread(
        target=func_map[task.task_func],
        kwargs=kwargs,
        daemon=True,
    ).start()
    return success()
