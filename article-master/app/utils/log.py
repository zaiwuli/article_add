import os
import sys
from pathlib import Path

from loguru import logger as uru_logger

from app.core.config import data_path

APP_LOG_DIR = Path(data_path) / "logs"
TRANSFER_LOG_DIR = Path(data_path) / "transfer"
LOG_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)


def _ensure_log_dirs():
    os.makedirs(APP_LOG_DIR, exist_ok=True)
    os.makedirs(TRANSFER_LOG_DIR, exist_ok=True)


def _add_file_sink(path: Path, *, filter=None):
    uru_logger.add(
        str(path),
        rotation="00:00",
        retention=7,
        compression="zip",
        encoding="utf-8",
        format=LOG_FORMAT,
        filter=filter,
    )


def setup_loguru_logger():
    _ensure_log_dirs()

    uru_logger.remove()
    _add_file_sink(APP_LOG_DIR / "app.log")
    _add_file_sink(
        TRANSFER_LOG_DIR / "transfer.log",
        filter=lambda record: record["extra"].get("category") == "transfer",
    )
    uru_logger.add(
        sink=sys.stdout,
        format=LOG_FORMAT,
        colorize=True,
    )
    return uru_logger


logger = setup_loguru_logger()
transfer_logger = logger.bind(category="transfer")
