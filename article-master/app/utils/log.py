import sys

from loguru import logger as uru_logger
import os

from app.core.config import data_path

log_dir = os.path.join(data_path, 'logs')

# 配置日志：按天归档到指定目录
def setup_loguru_logger():
    os.makedirs(log_dir, exist_ok=True)

    uru_logger.remove()

    uru_logger.add(
        f"{log_dir}/app.log",
        rotation="00:00",  # 每天午夜切割
        retention=7,  # 保留7天
        compression="zip",  # 压缩备份
        encoding="utf-8",
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    # 添加控制台输出
    uru_logger.add(
        sink=sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True
    )
    return uru_logger


logger = setup_loguru_logger()
