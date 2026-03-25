from typing import Optional

from pydantic import BaseModel


class TaskForm(BaseModel):
    id: Optional[int] = None
    task_name: str
    task_func: str
    task_args: Optional[str] = None
    task_cron: str
    enable: bool
