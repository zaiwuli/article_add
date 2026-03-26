from collections import deque
from datetime import datetime
from pathlib import Path

from app.core.config import data_path
from app.schemas.response import error, success

LOG_SCOPE_DIRS = {
    "app": Path(data_path) / "logs",
    "result": Path(data_path) / "result",
    "fails": Path(data_path) / "fails",
}

LOG_SCOPE_LABELS = {
    "app": "应用日志",
    "result": "抓取摘要",
    "fails": "失败记录",
}


def _serialize_file(path: Path):
    stat = path.stat()
    return {
        "name": path.name,
        "size": stat.st_size,
        "updated_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }


def list_log_files():
    scopes = []
    for scope, directory in LOG_SCOPE_DIRS.items():
        files = []
        if directory.exists():
            files = [
                _serialize_file(path)
                for path in sorted(
                    [item for item in directory.iterdir() if item.is_file()],
                    key=lambda item: item.stat().st_mtime,
                    reverse=True,
                )
            ]
        scopes.append(
            {
                "key": scope,
                "label": LOG_SCOPE_LABELS.get(scope, scope),
                "files": files,
            }
        )

    return success({"scopes": scopes})


def read_log_content(scope: str = "app", name: str | None = None, lines: int = 200):
    if scope not in LOG_SCOPE_DIRS:
        return error("unsupported log scope")

    directory = LOG_SCOPE_DIRS[scope]
    max_lines = max(1, min(lines, 1000))

    if not directory.exists():
        return success(
            {
                "scope": scope,
                "name": name,
                "lines": max_lines,
                "content": "",
                "updated_time": None,
                "size": 0,
            }
        )

    files = sorted(
        [item for item in directory.iterdir() if item.is_file()],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    if not files:
        return success(
            {
                "scope": scope,
                "name": name,
                "lines": max_lines,
                "content": "",
                "updated_time": None,
                "size": 0,
            }
        )

    selected = files[0] if not name else directory / Path(name).name
    resolved_directory = directory.resolve()
    resolved_file = selected.resolve()

    if resolved_directory not in resolved_file.parents or not resolved_file.exists():
        return error("log file not found")

    tail = deque(maxlen=max_lines)
    with resolved_file.open("r", encoding="utf-8", errors="ignore") as file:
        for line in file:
            tail.append(line.rstrip("\n"))

    stat = resolved_file.stat()
    return success(
        {
            "scope": scope,
            "name": resolved_file.name,
            "lines": max_lines,
            "content": "\n".join(tail),
            "updated_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "size": stat.st_size,
        }
    )
