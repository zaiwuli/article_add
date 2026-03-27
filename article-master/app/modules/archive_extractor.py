import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from app.utils.log import logger

ARCHIVE_EXTENSIONS = (
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".tgz",
    ".tbz2",
    ".iso",
)
PASSWORD_PATTERNS = (
    re.compile(
        r"(?:解压密码|解壓密碼|提取码|提取碼|密码|密碼|pass(?:word)?|pwd|口令)"
        r"\s*[:：=]\s*([^\s,，。；;<>]{1,64})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:解压|解壓).{0,6}?(?:密码|密碼|提取码|提取碼|口令).{0,3}?(?:为|是)"
        r"\s*([^\s,，。；;<>]{1,64})",
        re.IGNORECASE,
    ),
)
PASSWORD_STOPWORDS = {
    "",
    "无",
    "没有",
    "未知",
    "见图",
    "见附件",
    "回复可见",
    "购买可见",
    "本帖隐藏",
}
PASSWORD_ERROR_KEYWORDS = (
    "wrong password",
    "password",
    "encrypted",
    "can not open encrypted archive",
    "enter password",
    "crc failed in encrypted file",
)
DEFAULT_TIMEOUT_SECONDS = 4 * 60 * 60


def is_supported_archive(path: Path | str) -> bool:
    name = Path(path).name.lower()
    return any(name.endswith(ext) for ext in ARCHIVE_EXTENSIONS)


def normalize_password_candidate(value: str | None):
    if value is None:
        return None

    candidate = str(value).strip().strip("'\"[](){}<>")
    if not candidate:
        return None
    if len(candidate) > 64:
        return None
    if candidate.lower() in PASSWORD_STOPWORDS:
        return None
    if candidate.lower().startswith(("http://", "https://")):
        return None
    return candidate


def dedupe_strings(values):
    result = []
    seen = set()
    for value in values:
        candidate = normalize_password_candidate(value)
        if not candidate:
            continue
        lowered = candidate.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(candidate)
    return result


def split_password_dictionary(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return dedupe_strings(value)
    if isinstance(value, str):
        return dedupe_strings(re.split(r"[\r\n,;；]+", value))
    return dedupe_strings([value])


def extract_password_candidates(*texts: str):
    candidates = []
    for text in texts:
        if not text:
            continue
        normalized = re.sub(r"\s+", " ", str(text)).strip()
        for pattern in PASSWORD_PATTERNS:
            for match in pattern.finditer(normalized):
                candidates.append(match.group(1))
    return dedupe_strings(candidates)


def _resolve_binary(*names: str):
    for name in names:
        path = shutil.which(name)
        if path:
            return path
    return None


def _run_command(command: list[str], timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS):
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        timeout=timeout_seconds,
        check=False,
    )
    output = "\n".join(
        part.strip()
        for part in (completed.stdout, completed.stderr)
        if part and part.strip()
    ).strip()
    return completed.returncode, output


def _password_arg(password: str):
    return "-p-" if password == "" else f"-p{password}"


def _is_password_error(output: str):
    lowered = (output or "").lower()
    return any(keyword in lowered for keyword in PASSWORD_ERROR_KEYWORDS)


def _test_password(path: Path, password: str, *, use_unrar: bool):
    if use_unrar:
        binary = _resolve_binary("unrar")
        if not binary:
            return False, "未找到 unrar 可执行文件"
        command = [binary, "t", _password_arg(password), "-y", str(path)]
        code, output = _run_command(command)
        return code == 0, output

    binary = _resolve_binary("7zz", "7z")
    if not binary:
        return False, "未找到 7z/7zz 可执行文件"
    command = [binary, "t", str(path), _password_arg(password), "-y"]
    code, output = _run_command(command)
    return code == 0, output


def _extract_with_engine(
    path: Path,
    password: str,
    target_dir: Path,
    *,
    use_unrar: bool,
):
    if use_unrar:
        binary = _resolve_binary("unrar")
        if not binary:
            return False, "未找到 unrar 可执行文件"
        command = [
            binary,
            "x",
            _password_arg(password),
            "-y",
            str(path),
            str(target_dir) + os.sep,
        ]
        code, output = _run_command(command)
        return code == 0, output

    binary = _resolve_binary("7zz", "7z")
    if not binary:
        return False, "未找到 7z/7zz 可执行文件"
    command = [
        binary,
        "x",
        str(path),
        f"-o{target_dir}",
        _password_arg(password),
        "-y",
    ]
    code, output = _run_command(command)
    return code in (0, 1), output


def _next_available_path(directory: Path, name: str):
    target = directory / name
    if not target.exists():
        return target

    stem = Path(name).stem
    suffix = Path(name).suffix
    counter = 1
    while True:
        candidate = directory / f"{stem}_{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def _move_success_archive(path: Path, archive_root: Path):
    success_dir = archive_root / "解压成功"
    success_dir.mkdir(parents=True, exist_ok=True)
    target = _next_available_path(success_dir, path.name)
    shutil.move(str(path), str(target))
    return target


def extract_archive_file(
    archive_path: Path,
    *,
    output_root: Path,
    archive_root: Path | None = None,
    password_candidates: list[str] | None = None,
    move_original: bool = True,
    delete_original: bool = False,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
):
    archive_path = Path(archive_path)
    output_root = Path(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    if not archive_path.exists():
        return {
            "ok": False,
            "message": "压缩包文件不存在",
        }
    if not is_supported_archive(archive_path):
        return {
            "ok": False,
            "message": "不支持的压缩包格式",
        }

    use_unrar = archive_path.name.lower().endswith(".rar") and bool(
        _resolve_binary("unrar")
    )
    if not use_unrar and not _resolve_binary("7zz", "7z"):
        return {
            "ok": False,
            "message": "未找到 7z/7zz 解压工具",
        }

    candidate_passwords = [""]
    candidate_passwords.extend(password_candidates or [])
    candidate_passwords = [""] + [
        item for item in dedupe_strings(candidate_passwords) if item != ""
    ]

    selected_password = None
    last_output = ""
    for password in candidate_passwords:
        matched, output = _test_password(
            archive_path,
            password,
            use_unrar=use_unrar,
        )
        last_output = output
        if matched:
            selected_password = password
            break

    if selected_password is None:
        message = "自动密码字典未命中"
        if not candidate_passwords or candidate_passwords == [""]:
            message = "压缩包可能需要密码，但当前没有可用密码"
        elif not _is_password_error(last_output):
            message = f"压缩包测试失败: {last_output or '未知错误'}"
        return {
            "ok": False,
            "message": message,
            "needs_password": True,
        }

    temp_dir = Path(tempfile.mkdtemp(prefix="crawl_extract_", dir=str(output_root)))
    final_dir = _next_available_path(output_root, archive_path.stem)
    try:
        success, output = _extract_with_engine(
            archive_path,
            selected_password,
            temp_dir,
            use_unrar=use_unrar,
        )
        if not success:
            return {
                "ok": False,
                "message": f"解压失败: {output or '未知错误'}",
                "needs_password": _is_password_error(output),
            }

        temp_dir.rename(final_dir)
        archived_to = None
        if delete_original:
            archive_path.unlink(missing_ok=True)
        elif move_original and archive_root:
            archive_root.mkdir(parents=True, exist_ok=True)
            archived_to = _move_success_archive(archive_path, archive_root)

        logger.info(
            f"压缩包解压成功: source={archive_path} output={final_dir} "
            f"engine={'unrar' if use_unrar else '7z'}"
        )
        return {
            "ok": True,
            "output_path": str(final_dir),
            "archived_to": str(archived_to) if archived_to else None,
            "password_used": bool(selected_password),
        }
    finally:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
