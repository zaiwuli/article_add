from collections import deque
from datetime import datetime
from pathlib import Path

from app.core.config import data_path
from app.schemas.response import error, success

LOG_SCOPE_DIRS = {
    "app": Path(data_path) / "logs",
    "transfer": Path(data_path) / "transfer",
    "result": Path(data_path) / "result",
    "fails": Path(data_path) / "fails",
}

LOG_SCOPE_LABELS = {
    "app": "应用日志",
    "transfer": "转存日志",
    "result": "抓取摘要",
    "fails": "失败记录",
}


def _serialize_file(path: Path):
    stat = path.stat()
    return {
        "name": path.name,
        "size": stat.st_size,
        "updated_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "compressed": False,
    }


def _list_scope_files(directory: Path):
    if not directory.exists():
        return []

    files = sorted(
        [
            item
            for item in directory.iterdir()
            if item.is_file() and item.suffix.lower() != ".zip"
        ],
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    if not files:
        return []

    return [_serialize_file(files[0])]


def _decode_content(raw: bytes):
    for encoding in ("utf-8", "utf-8-sig", "gb18030"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _tail_text(path: Path, lines: int):
    tail = deque(maxlen=lines)
    for line in _decode_content(path.read_bytes()).splitlines():
        tail.append(line)
    return "\n".join(tail)


def list_log_files():
    scopes = []
    for scope, directory in LOG_SCOPE_DIRS.items():
        scopes.append(
            {
                "key": scope,
                "label": LOG_SCOPE_LABELS.get(scope, scope),
                "files": _list_scope_files(directory),
            }
        )

    return success({"scopes": scopes})


def read_log_content(scope: str = "app", name: str | None = None, lines: int = 200):
    if scope not in LOG_SCOPE_DIRS:
        return error("unsupported log scope")

    directory = LOG_SCOPE_DIRS[scope]
    max_lines = max(1, min(lines, 1000))
    files = _list_scope_files(directory)

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

    current_name = files[0]["name"]
    target_name = current_name if not name else Path(name).name
    if target_name != current_name:
        return error("only the latest log file is previewed in the UI")

    resolved_file = (directory / current_name).resolve()
    resolved_directory = directory.resolve()
    if resolved_directory not in resolved_file.parents or not resolved_file.exists():
        return error("log file not found")

    stat = resolved_file.stat()
    return success(
        {
            "scope": scope,
            "name": resolved_file.name,
            "lines": max_lines,
            "content": _tail_text(resolved_file, max_lines),
            "updated_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "size": stat.st_size,
        }
    )
