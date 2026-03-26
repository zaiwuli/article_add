from urllib.parse import parse_qs, urlparse

from sqlalchemy import (
    MetaData,
    Table,
    and_,
    bindparam,
    create_engine,
    func,
    inspect,
    select,
    text,
    tuple_,
    update,
)
from sqlalchemy.orm import Session
from sqlalchemy.types import ARRAY, JSON

from app.api.services.user_service import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
)
from app.core.security import get_password_hash
from app.models.article import Article
from app.models.config import Config
from app.models.task import Task
from app.models.user import User
from app.modules.sht import sht
from app.scheduler.sht_section_registry import get_section_config
from app.schemas.response import error, success

TRANSFER_REQUIRED_COLUMNS = (
    "tid",
    "title",
    "publish_date",
    "magnet",
    "edk",
    "preview_images",
    "detail_url",
    "size",
    "section",
    "category",
    "website",
    "create_time",
    "update_time",
)
TRANSFER_BATCH_SIZE = 500
POSTGRES_SYSTEM_SCHEMAS = {"information_schema", "pg_catalog", "pg_toast"}


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


def _normalize_website(url: str, fallback: str | None = None):
    parsed = urlparse(url)
    return (fallback or parsed.netloc or "sehuatang").strip()


def _chunked(items, size: int):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def _split_qualified_table_name(table_name: str):
    cleaned = table_name.strip()
    parts = cleaned.split(".", 1)
    if len(parts) == 2:
        return parts[0].strip('"'), parts[1].strip('"')
    return None, parts[0].strip('"')


def _create_target_engine(database_url: str):
    return create_engine(database_url.strip(), future=True, pool_pre_ping=True)


def _load_target_table(engine, table_name: str):
    schema_name, pure_table_name = _split_qualified_table_name(table_name)
    metadata = MetaData()
    return Table(
        pure_table_name,
        metadata,
        schema=schema_name,
        autoload_with=engine,
    )


def _normalize_transfer_value(column, value):
    if isinstance(column.type, ARRAY):
        if value is None:
            return []
        if isinstance(value, str):
            stripped = value.strip()
            return [stripped] if stripped else []
        if isinstance(value, (list, tuple, set)):
            return [str(item).strip() for item in value if str(item).strip()]
        return [str(value).strip()]

    if isinstance(value, (list, tuple, set)):
        if isinstance(column.type, JSON):
            return list(value)
        return ",".join(str(item).strip() for item in value if str(item).strip())

    return value


def _should_include_transfer_id(target_table: Table):
    id_column = target_table.c.get("id")
    if id_column is None:
        return False
    if id_column.server_default is not None or id_column.default is not None:
        return False
    if bool(id_column.autoincrement):
        return False
    return True


def _build_transfer_row(
    article: Article,
    target_table: Table,
    *,
    include_id: bool = False,
):
    payload = {}
    if include_id and "id" in target_table.c:
        payload["id"] = getattr(article, "id")
    for column_name in TRANSFER_REQUIRED_COLUMNS:
        if column_name not in target_table.c:
            continue
        payload[column_name] = _normalize_transfer_value(
            target_table.c[column_name],
            getattr(article, column_name),
        )
    return payload


def _upsert_article(db: Session, data: dict):
    article = (
        db.query(Article)
        .filter(Article.website == data["website"], Article.tid == data["tid"])
        .first()
    )
    if article:
        for key, value in data.items():
            setattr(article, key, value)
        return "updated"

    db.add(Article(data))
    return "created"


def _save_detail_url(
    db: Session,
    url: str,
    tid: int,
    section: str,
    website: str,
):
    article = sht.crawler_detail(url)
    if not article:
        return None

    payload = dict(article)
    payload.update(
        {
            "tid": tid,
            "section": section,
            "website": website,
            "detail_url": url,
        }
    )
    return _upsert_article(db, payload)


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


def save_url(url: str, db: Session, fid: str | None = None):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return error("invalid url")

    mod = _extract_query_value(url, "mod")
    if mod == "forumdisplay" or _extract_query_value(url, "fid"):
        target_fid = fid or _extract_query_value(url, "fid")
        if not target_fid:
            return error("fid is required for forumdisplay save")

        section_config = get_section_config(target_fid)
        section = section_config["section"]
        website = _normalize_website(url, section_config.get("website"))
        tid_list = sht.crawler_tid_list(url)
        if not tid_list:
            return error("failed to crawl target url")

        existing_tids = set(
            db.execute(
                select(Article.tid).filter(
                    Article.website == website,
                    Article.tid.in_(tid_list),
                )
            )
            .scalars()
            .all()
        )

        created = 0
        updated = 0
        failed_ids = []
        for tid in tid_list:
            detail_url = _build_detail_url(url, tid)
            status = _save_detail_url(
                db=db,
                url=detail_url,
                tid=tid,
                section=section,
                website=website,
            )
            if status == "created":
                created += 1
                continue
            if status == "updated":
                if tid in existing_tids:
                    updated += 1
                else:
                    created += 1
                continue
            failed_ids.append(tid)

        db.flush()
        return success(
            {
                "mode": "forumdisplay",
                "fid": str(target_fid),
                "section": section,
                "website": website,
                "count": len(tid_list),
                "created": created,
                "updated": updated,
                "failed_ids": failed_ids,
            },
            message="resources saved",
        )

    if mod == "viewthread" or _extract_query_value(url, "tid"):
        tid = _extract_query_value(url, "tid")
        if not tid:
            return error("tid is required for viewthread save")

        section_config = get_section_config(fid) if fid else None
        section = section_config["section"] if section_config else "manual"
        website = _normalize_website(
            url,
            section_config.get("website") if section_config else None,
        )
        status = _save_detail_url(
            db=db,
            url=url,
            tid=int(tid),
            section=section,
            website=website,
        )
        if not status:
            return error("failed to crawl target url")

        db.flush()
        return success(
            {
                "mode": "viewthread",
                "tid": int(tid),
                "section": section,
                "website": website,
                "action": status,
            },
            message="resource saved",
        )

    return error("unsupported url, only forumdisplay and viewthread are supported")


def list_transfer_tables(database_url: str):
    try:
        engine = _create_target_engine(database_url)
        inspector = inspect(engine)
        dialect = engine.dialect.name
        schema_names = []
        try:
            schema_names = inspector.get_schema_names()
        except NotImplementedError:
            schema_names = []

        if dialect == "postgresql":
            schema_names = [
                schema_name
                for schema_name in schema_names
                if schema_name not in POSTGRES_SYSTEM_SCHEMAS
            ]
        elif dialect == "sqlite":
            schema_names = ["main"]

        if not schema_names:
            schema_names = [None]

        seen_tables = set()
        tables = []
        for schema_name in schema_names:
            inspect_kwargs = {"schema": schema_name} if schema_name is not None else {}
            for table_name in inspector.get_table_names(**inspect_kwargs):
                qualified_name = (
                    table_name
                    if schema_name in (None, "main")
                    else f"{schema_name}.{table_name}"
                )
                if qualified_name in seen_tables:
                    continue
                seen_tables.add(qualified_name)
                tables.append(
                    {
                        "schema": None if schema_name in (None, "main") else schema_name,
                        "name": table_name,
                        "qualified_name": qualified_name,
                    }
                )

        tables.sort(key=lambda item: item["qualified_name"])
        return success({"dialect": dialect, "tables": tables})
    except Exception as exc:
        return error(f"failed to load target database tables: {exc}")
    finally:
        if "engine" in locals():
            engine.dispose()


def transfer_articles(database_url: str, table_name: str, db: Session):
    source_articles = db.query(Article).order_by(Article.id.asc()).all()
    if not source_articles:
        return success(
            {
                "table_name": table_name,
                "total": 0,
                "inserted": 0,
                "updated": 0,
            },
            message="no article data to transfer",
        )

    try:
        engine = _create_target_engine(database_url)
        target_table = _load_target_table(engine, table_name)

        missing_columns = [
            column_name
            for column_name in TRANSFER_REQUIRED_COLUMNS
            if column_name not in target_table.c
        ]
        if missing_columns:
            return error(
                "target table is missing required columns: "
                + ", ".join(missing_columns)
            )

        include_id_on_insert = _should_include_transfer_id(target_table)
        source_rows = [
            _build_transfer_row(
                article,
                target_table,
                include_id=include_id_on_insert,
            )
            for article in source_articles
        ]
        unique_pairs = list(
            dict.fromkeys(
                (row["website"], row["tid"])
                for row in source_rows
                if row.get("website") and row.get("tid") is not None
            )
        )

        with engine.begin() as connection:
            existing_pairs = set()
            for pair_chunk in _chunked(unique_pairs, TRANSFER_BATCH_SIZE):
                if not pair_chunk:
                    continue
                existing_rows = connection.execute(
                    select(target_table.c.website, target_table.c.tid).where(
                        tuple_(target_table.c.website, target_table.c.tid).in_(
                            pair_chunk
                        )
                    )
                ).all()
                existing_pairs.update((row[0], row[1]) for row in existing_rows)

            insert_rows = []
            update_rows = []
            for row in source_rows:
                pair = (row.get("website"), row.get("tid"))
                if pair[0] and pair[1] is not None and pair in existing_pairs:
                    update_rows.append(row)
                else:
                    insert_rows.append(row)

            if insert_rows:
                connection.execute(target_table.insert(), insert_rows)

            if update_rows:
                update_columns = [
                    column_name
                    for column_name in TRANSFER_REQUIRED_COLUMNS
                    if column_name not in {"website", "tid"}
                    and column_name in target_table.c
                ]
                if update_columns:
                    update_stmt = (
                        update(target_table)
                        .where(
                            and_(
                                target_table.c.website == bindparam("_website_key"),
                                target_table.c.tid == bindparam("_tid_key"),
                            )
                        )
                        .values(
                            {
                                column_name: bindparam(column_name)
                                for column_name in update_columns
                            }
                        )
                    )
                    connection.execute(
                        update_stmt,
                        [
                            {
                                **{
                                    column_name: row[column_name]
                                    for column_name in update_columns
                                },
                                "_website_key": row["website"],
                                "_tid_key": row["tid"],
                            }
                            for row in update_rows
                        ],
                    )

        return success(
            {
                "table_name": target_table.fullname,
                "total": len(source_rows),
                "inserted": len(insert_rows),
                "updated": len(update_rows),
            },
            message="articles transferred",
        )
    except Exception as exc:
        return error(f"failed to transfer articles: {exc}")
    finally:
        if "engine" in locals():
            engine.dispose()


def reset_resource_table(db: Session):
    count = db.execute(select(func.count(Article.id))).scalar() or 0
    db.execute(text("TRUNCATE TABLE sht.article RESTART IDENTITY"))
    db.flush()
    return success(
        {
            "deleted": count,
        },
        message="resource table reset",
    )


def reset_test_space(db: Session):
    article_count = db.execute(select(func.count(Article.id))).scalar() or 0
    task_count = db.execute(select(func.count(Task.id))).scalar() or 0
    config_count = db.execute(select(func.count(Config.id))).scalar() or 0
    user_count = db.execute(select(func.count(User.id))).scalar() or 0

    db.execute(
        text(
            "TRUNCATE TABLE sht.article, sht.task, sht.config, sht.\"user\" RESTART IDENTITY"
        )
    )

    admin_user = User(
        username=DEFAULT_ADMIN_USERNAME,
        hashed_password=get_password_hash(DEFAULT_ADMIN_PASSWORD),
    )
    db.add(admin_user)

    db.flush()
    return success(
        {
            "article_deleted": article_count,
            "task_deleted": task_count,
            "config_deleted": config_count,
            "user_deleted": user_count,
            "default_username": DEFAULT_ADMIN_USERNAME,
            "default_password": DEFAULT_ADMIN_PASSWORD,
        },
        message="test space reset",
    )
