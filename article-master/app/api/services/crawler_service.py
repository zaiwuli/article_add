from urllib.parse import parse_qs, urlparse

from app.modules.sht import sht
from app.schemas.response import error, success


def _extract_query_value(url: str, key: str):
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get(key, [])
    return values[0] if values else None


def _build_detail_url(url: str, tid: int):
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc or "sehuatang.org"
    return (
        f"{scheme}://{netloc}/forum.php?"
        f"mod=viewthread&tid={tid}&extra=page%3D1&mobile=2"
    )


def preview_url(url: str):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("invalid url")

    runtime = sht.get_runtime_config()
    mod = _extract_query_value(url, "mod")

    if mod == "forumdisplay" or _extract_query_value(url, "fid"):
        tid_list = sht.crawler_tid_list(url)
        return success(
            {
                "mode": "forumdisplay",
                "url": url,
                "fid": _extract_query_value(url, "fid"),
                "count": len(tid_list),
                "items": [
                    {
                        "tid": tid,
                        "detail_url": _build_detail_url(url, tid),
                    }
                    for tid in tid_list
                ],
                "runtime": runtime,
            }
        )

    if mod == "viewthread" or _extract_query_value(url, "tid"):
        article = sht.crawler_detail(url)
        if not article:
            return error("failed to crawl target url")

        article["tid"] = _extract_query_value(url, "tid")
        article["detail_url"] = url
        article["website"] = parsed.netloc
        return success(
            {
                "mode": "viewthread",
                "url": url,
                "article": article,
                "runtime": runtime,
            }
        )

    return error("unsupported url, only forumdisplay and viewthread are supported")
