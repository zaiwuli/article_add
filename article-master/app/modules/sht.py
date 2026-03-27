import binascii
import hashlib
import json
import re
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

import bencoder
from curl_cffi import requests
from pyquery import PyQuery as pq

from app.core import settings
from app.core.database import session_scope
from app.models import Config
from app.utils.log import logger

CRAWLER_RUNTIME_CONFIG_KEY = "CrawlerRuntime"
MAGNET_PATTERN = re.compile(
    r"magnet:\?xt=urn:btih:[0-9a-fA-F]+(?:[^\s]*)?",
    re.IGNORECASE,
)
ATTACHMENT_NAME_PATTERN = re.compile(
    r'([^"\'<>]+?\.(torrent|txt|nfo|zip|rar|7z))',
    re.IGNORECASE,
)
TEXT_ATTACHMENT_EXTENSIONS = {"txt", "nfo"}
ARCHIVE_ATTACHMENT_EXTENSIONS = {"zip", "rar", "7z"}
TEXT_ATTACHMENT_MAX_BYTES = 1024 * 1024


def get_default_runtime_config():
    return {
        "proxy": settings.PROXY or "",
        "flare_solver_url": settings.FLARE_SOLVERR_URL or "",
    }


def extract_and_convert_video_size(html_content):
    doc = pq(html_content)
    message_text = doc(".message").text()
    clean_text = re.sub(r"\s+", " ", message_text).strip()
    pattern = r"(\d+\.?\d*)([GM])"
    match = re.search(pattern, clean_text)
    if not match:
        return None

    size_num_str, unit = match.groups()
    try:
        size_num = float(size_num_str)
    except ValueError:
        return None

    if unit.upper() == "G":
        mb_size = size_num * 1024
    elif unit.upper() == "M":
        mb_size = size_num
    else:
        return None
    return int(mb_size)


def extract_safeid(html_content):
    doc = pq(html_content)
    for script_elem in doc("script"):
        script_text = pq(script_elem).text().strip()
        if not script_text or "safeid" not in script_text:
            continue
        match = re.search(r"safeid\s*=\s*['\"]([^'\"]+)['\"]", script_text)
        if match:
            return match.group(1)
    return None


def extract_exact_date(html_content):
    doc = pq(html_content)
    date_text = doc("dt.z.cl").eq(0).text().strip()
    if not date_text:
        return ""

    processed_text = re.sub(r"\s+", " ", date_text.replace("&nbsp;", " ")).strip()
    today = datetime.now().date()
    if re.match(r"^\d+ \u5c0f\u65f6\u524d$", processed_text):
        return today.strftime("%Y-%m-%d")
    if processed_text == "\u534a\u5c0f\u65f6\u524d":
        return today.strftime("%Y-%m-%d")
    if re.match(r"^\d+ \u5206\u949f\u524d$", processed_text):
        return today.strftime("%Y-%m-%d")
    if re.match(r"^\d+ \u79d2\u524d$", processed_text):
        return today.strftime("%Y-%m-%d")
    if processed_text.startswith("\u6628\u5929 "):
        return (today - timedelta(days=1)).strftime("%Y-%m-%d")
    if processed_text.startswith("\u524d\u5929 "):
        return (today - timedelta(days=2)).strftime("%Y-%m-%d")
    if re.match(r"^\d+ \u5929\u524d$", processed_text):
        days = int(re.search(r"(\d+) \u5929\u524d", processed_text).group(1))
        return (today - timedelta(days=days)).strftime("%Y-%m-%d")
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", processed_text):
        return processed_text.split(" ")[0]

    logger.warning(f"未识别的日期格式: {date_text}")
    return None


def extract_bracket_content(html_content):
    doc = pq(html_content)
    h2_text = doc("h2.n5_bbsnrbt").text().strip()
    match = re.search(r"\[(.*?)\]", h2_text)
    if match:
        return match.group(1)
    return None


def extract_edk(text):
    match = re.search(r"ed2k://\|file\|.+?\|/", text)
    if match:
        return match.group()
    return None


def extract_magnet(text):
    match = MAGNET_PATTERN.search(text or "")
    if match:
        return match.group()
    return None


def extract_attachment_name(*values):
    for value in values:
        if not value:
            continue
        match = ATTACHMENT_NAME_PATTERN.search(str(value))
        if match:
            name = re.sub(r"\s+", " ", match.group(1)).strip()
            return name, match.group(2).lower()
    return None, None


def decode_text_payload(payload):
    if len(payload) > TEXT_ATTACHMENT_MAX_BYTES:
        raise ValueError(f"text attachment exceeds limit: {len(payload)} bytes")

    for encoding in ("utf-8-sig", "utf-8", "gb18030", "big5"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue

    return payload.decode("utf-8", errors="ignore")


class SHT:
    proxy: str = None
    proxies = {}
    headers = {}
    cookie = {}
    flare_solver = None

    def __init__(self):
        ua = (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 "
            "Mobile/15E148 Safari/604.1"
        )
        self.headers = {"User-Agent": ua}
        self.cookie = {"_safe": ""}
        self.apply_runtime_config(get_default_runtime_config())

    def apply_runtime_config(self, runtime_config):
        proxy = (runtime_config.get("proxy") or "").strip()
        self.proxy = proxy or None
        self.proxies = (
            {
                "http": proxy,
                "https": proxy,
            }
            if proxy
            else None
        )
        self.flare_solver = (runtime_config.get("flare_solver_url") or "").strip() or None

    def get_runtime_config(self):
        runtime_config = get_default_runtime_config()
        try:
            with session_scope() as session:
                config = (
                    session.query(Config)
                    .filter(Config.key == CRAWLER_RUNTIME_CONFIG_KEY)
                    .first()
                )
            if config and config.content:
                payload = json.loads(str(config.content))
                if isinstance(payload, dict):
                    if "proxy" in payload:
                        runtime_config["proxy"] = payload.get("proxy") or ""
                    if "flare_solver_url" in payload:
                        runtime_config["flare_solver_url"] = (
                            payload.get("flare_solver_url") or ""
                        )
        except Exception as exc:
            logger.warning(f"加载抓取运行配置失败: {exc}")
        return runtime_config

    def refresh_runtime_config(self):
        self.apply_runtime_config(self.get_runtime_config())

    def get_original(self, url):
        self.refresh_runtime_config()
        res = requests.get(
            url,
            proxies=self.proxies,
            cookies=self.cookie,
            headers=self.headers,
            allow_redirects=True,
            timeout=10,
            impersonate="chrome110",
        )
        html = res.text.encode("utf-8")
        doc = pq(html)
        page_title = doc("head>title").text()

        if "Just a moment" in page_title:
            logger.warning("检测到 Cloudflare 验证")
            html = self.bypass_cf(url)
            if not html:
                logger.error("绕过 Cloudflare 验证失败")
                return None

        doc = pq(html)
        if "var safeid" in doc.text():
            logger.warning("检测到 safeid 验证")
            html = self.bypass_r18(html, url)
            if not html:
                logger.error("绕过 safeid 验证失败")
                return None

        doc = pq(html)
        if doc("div.n5_htnrys.cl") or doc("div.message") or doc("h2.n5_bbsnrbt"):
            return html

        if page_title:
            logger.warning(f"页面标题异常: {page_title}")
        return None

    def bypass_cf(self, url):
        if not self.flare_solver:
            logger.error("未配置 FlareSolverR 地址")
            return None

        payload = {
            "cmd": "request.get",
            "url": url,
            "maxTimeout": 60000,
            "cookies": [
                {"name": key, "value": value}
                for key, value in self.cookie.items()
            ],
        }
        if self.proxy:
            payload["proxy"] = {"url": self.proxy}
        res = requests.post(
            self.flare_solver,
            headers={"Content-Type": "application/json"},
            json=payload,
        )
        result = res.json()
        if result["solution"]["status"] != 200:
            return None

        html = result["solution"]["response"].encode("utf-8")
        doc = pq(html)
        if "var safeid" in doc.text():
            safeid = extract_safeid(html)
            self.cookie["_safe"] = safeid
            return self.bypass_cf(url)
        return html

    def bypass_r18(self, html, url):
        safeid = extract_safeid(html)
        if not safeid:
            return None

        self.cookie["_safe"] = safeid
        res = requests.get(
            url,
            proxies=self.proxies,
            cookies=self.cookie,
            headers=self.headers,
            allow_redirects=True,
            timeout=10,
            impersonate="chrome110",
        )
        html = res.text.encode("utf-8")
        doc = pq(html)
        if doc("div.n5_htnrys.cl") or doc("div.message") or doc("h2.n5_bbsnrbt"):
            return html
        return None

    def crawler_tid_list(self, url):
        try:
            html = self.get_original(url)
            if not html:
                return []

            doc = pq(html)
            items = doc("div.n5_htnrys.cl")[1:]
            id_list = []
            for item in items:
                link = pq(item)("div a").eq(0).attr("href")
                if not link:
                    continue
                parsed_url = urlparse(link)
                query_params = parse_qs(parsed_url.query)
                tid = query_params.get("tid", [""])[0]
                if tid:
                    id_list.append(int(tid))
            return id_list
        except Exception as exc:
            logger.error(f"抓取帖子列表失败 {url}: {exc}")
            return []

    def collect_attachment_candidates(self, doc, refer):
        candidates = []
        seen = set()
        for item in doc("a").items():
            href = (item.attr("href") or "").strip()
            if not href or href.startswith("#") or href.lower().startswith("javascript:"):
                continue

            name, ext = extract_attachment_name(
                item.text(),
                item.attr("title"),
                item.attr("download"),
                href,
            )
            if not ext:
                continue

            attachment_url = urljoin(refer, href)
            key = (attachment_url, ext)
            if key in seen:
                continue

            seen.add(key)
            candidates.append(
                {
                    "name": name or attachment_url,
                    "url": attachment_url,
                    "ext": ext,
                }
            )
        return candidates

    def download_attachment_bytes(self, refer, source):
        self.refresh_runtime_config()
        headers = dict(self.headers)
        headers["Referer"] = refer
        resp = requests.get(
            source,
            proxies=self.proxies,
            cookies=self.cookie,
            headers=headers,
            allow_redirects=True,
            timeout=10,
            impersonate="chrome110",
        )
        resp.raise_for_status()
        return resp.content

    def parse_text_attachment(self, refer, source):
        payload = self.download_attachment_bytes(refer, source)
        return decode_text_payload(payload)

    def parse_text_file(self, source):
        with open(source, "rb") as file:
            payload = file.read()
        return decode_text_payload(payload)

    def inspect_detail(self, url):
        try:
            html = self.get_original(url)
            if not html:
                return {
                    "ok": False,
                    "status": "failed",
                    "issue_type": "detail_fetch_failed",
                    "stage": "detail_fetch",
                    "reason_code": "detail_fetch_failed",
                    "reason_message": "详情页加载失败",
                    "attachments": [],
                    "title": None,
                    "category": None,
                    "publish_date": None,
                    "preview_images": [],
                    "size": None,
                    "article": None,
                }

            doc = pq(html)
            title = doc("h2.n5_bbsnrbt").text()
            title = re.sub(r"^\[.*?\]", "", title).strip()
            img_src_list = []
            for img in doc("div.message img").items():
                src = img.attr("src")
                if src:
                    img_src_list.append(src.strip())

            base_payload = {
                "title": title,
                "category": extract_bracket_content(html),
                "publish_date": extract_exact_date(html),
                "preview_images": img_src_list,
                "size": extract_and_convert_video_size(html),
            }

            all_text = doc("div.blockcode").text()
            magnet = extract_magnet(all_text)
            edk = extract_edk(all_text)
            attachment_candidates = self.collect_attachment_candidates(doc, url)
            text_candidates = [
                item
                for item in attachment_candidates
                if item["ext"] in TEXT_ATTACHMENT_EXTENSIONS
            ]
            archive_candidates = [
                item
                for item in attachment_candidates
                if item["ext"] in ARCHIVE_ATTACHMENT_EXTENSIONS
            ]
            text_errors = []

            if (not magnet or not edk) and text_candidates:
                for candidate in text_candidates:
                    try:
                        attachment_text = self.parse_text_attachment(
                            url, candidate["url"]
                        )
                    except Exception as exc:
                        logger.warning(f"解析文本附件失败 {candidate['url']}: {exc}")
                        text_errors.append(
                            f"{candidate['name']}：解析文本附件失败"
                        )
                        continue

                    if not magnet:
                        magnet = extract_magnet(attachment_text)
                    if not edk:
                        edk = extract_edk(attachment_text)
                    if magnet and edk:
                        break

            if not magnet:
                for candidate in attachment_candidates:
                    if candidate["ext"] == "torrent":
                        magnet = self.parse_torrent_get_magnet(
                            url,
                            candidate["url"],
                        )
                        if magnet:
                            break

            if magnet or edk:
                return {
                    "ok": True,
                    "article": {
                        **base_payload,
                        "magnet": [magnet] if magnet else [],
                        "edk": [edk] if edk else [],
                    },
                    "attachments": attachment_candidates,
                    **base_payload,
                }

            if archive_candidates:
                return {
                    "ok": False,
                    "status": "pending_manual",
                    "issue_type": "archive_detected",
                    "stage": "resource_parse",
                    "reason_code": "archive_detected",
                    "reason_message": "检测到压缩包附件，需要下载后在外部解压",
                    "attachments": archive_candidates,
                    "article": None,
                    **base_payload,
                }

            reason_message = "未找到可直接入库的磁力、ED2K 或可解析附件"
            if text_errors:
                reason_message = "; ".join(text_errors[:2])

            return {
                "ok": False,
                "status": "failed",
                "issue_type": "resource_missing",
                "stage": "resource_parse",
                "reason_code": "download_resource_missing",
                "reason_message": reason_message,
                "attachments": attachment_candidates,
                "article": None,
                **base_payload,
            }
        except Exception as exc:
            logger.error(f"抓取详情页失败 {url}: {exc}")
            return {
                "ok": False,
                "status": "failed",
                "issue_type": "crawl_exception",
                "stage": "detail_parse",
                "reason_code": "crawl_detail_exception",
                "reason_message": f"详情解析异常：{str(exc)}",
                "attachments": [],
                "title": None,
                "category": None,
                "publish_date": None,
                "preview_images": [],
                "size": None,
                "article": None,
            }

    def crawler_detail(self, url):
        result = self.inspect_detail(url)
        if result.get("ok") and result.get("article"):
            return dict(result["article"])
        return {}

    def parse_torrent_get_magnet(self, refer, torrent_source, is_local=False):
        try:
            if is_local:
                with open(torrent_source, "rb") as file:
                    torrent_bin = file.read()
                if len(torrent_bin) == 0:
                    logger.error("本地种子文件为空")
                    return None
            else:
                headers = dict(self.headers)
                headers["Referer"] = refer
                resp = requests.get(
                    torrent_source,
                    proxies=self.proxies,
                    cookies=self.cookie,
                    headers=headers,
                    allow_redirects=True,
                    timeout=10,
                    impersonate="chrome110",
                )
                resp.raise_for_status()
                torrent_bin = resp.content
                if len(torrent_bin) < 100:
                    logger.error(
                        f"种子附件内容异常，文件过小: {len(torrent_bin)} bytes"
                    )
                    return None

            torrent_dict = bencoder.decode(torrent_bin)
            if b"info" in torrent_dict:
                info_dict = torrent_dict[b"info"]
            elif "info" in torrent_dict:
                info_dict = torrent_dict["info"]
            else:
                logger.error("种子文件缺少 info 节点")
                return None

            info_bin = bencoder.encode(info_dict)
            info_hash = hashlib.sha1(info_bin).digest()
            info_hash_hex = binascii.hexlify(info_hash).decode("utf-8")

            torrent_name = "Unknown_Torrent"
            if b"name" in info_dict:
                torrent_name = info_dict[b"name"]
            elif "name" in info_dict:
                torrent_name = info_dict["name"]

            if isinstance(torrent_name, bytes):
                torrent_name = torrent_name.decode("utf-8", errors="ignore")
            elif not isinstance(torrent_name, str):
                torrent_name = str(torrent_name)

            encoded_name = urlencode({"dn": torrent_name})[3:]
            return f"magnet:?xt=urn:btih:{info_hash_hex}&dn={encoded_name}"
        except Exception as exc:
            logger.error(f"解析种子文件失败: {exc}")
            return None


sht = SHT()
