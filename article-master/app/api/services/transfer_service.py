from itertools import islice

from sqlalchemy import MetaData, Table, create_engine, inspect, select, tuple_
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.sql.sqltypes import ARRAY

from app.api.services.article_service import normalize_string_list
from app.api.services.config_service import (
    ARTICLE_TRANSFER_TARGET_CONFIG_KEY,
    get_default_transfer_target_config,
    load_config_payload,
    save_option,
)
from app.models.article import Article
from app.schemas.config import JsonPayload
from app.schemas.response import error, success
from app.schemas.transfer import TransferTargetPayload

TRANSFER_FIELDS = (
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


def _chunked(values, size):
    iterator = iter(values)
    while True:
        chunk = list(islice(iterator, size))
        if not chunk:
            return
        yield chunk


def _normalize_target_payload(payload: TransferTargetPayload | dict | None):
    data = get_default_transfer_target_config()
    if isinstance(payload, TransferTargetPayload):
        data.update(payload.model_dump())
    elif isinstance(payload, dict):
        data.update(payload)

    data["host"] = str(data.get("host", "")).strip()
    data["database"] = str(data.get("database", "")).strip()
    data["username"] = str(data.get("username", "")).strip()
    data["password"] = str(data.get("password", "")).strip()
    data["schema"] = str(data.get("schema", "public") or "public").strip()
    data["table"] = str(data.get("table", "")).strip()
    data["port"] = int(data.get("port") or 5432)
    return data


def _validate_connection_payload(data: dict, require_table: bool = False):
    required_fields = ["host", "database", "username", "password", "schema"]
    for field in required_fields:
        if not data.get(field):
            return error(f"{field} is required")
    if require_table and not data.get("table"):
        return error("table is required")
    return None


def _build_database_url(data: dict):
    return URL.create(
        drivername="postgresql+psycopg2",
        username=data["username"],
        password=data["password"],
        host=data["host"],
        port=data["port"],
        database=data["database"],
    )


def _create_external_engine(data: dict):
    return create_engine(_build_database_url(data), pool_pre_ping=True)


def _load_saved_target_config(db: Session):
    payload = load_config_payload(ARTICLE_TRANSFER_TARGET_CONFIG_KEY, db)
    return _normalize_target_payload(payload)


def _get_target_table(connection, schema: str, table_name: str):
    metadata = MetaData()
    return Table(table_name, metadata, schema=schema, autoload_with=connection)


def _get_missing_columns(target_table):
    target_columns = {column.name for column in target_table.columns}
    return [field for field in TRANSFER_FIELDS if field not in target_columns]


def _serialize_article(article: Article):
    return {
        "tid": article.tid,
        "title": article.title,
        "publish_date": article.publish_date,
        "magnet": normalize_string_list(article.magnet),
        "edk": normalize_string_list(article.edk),
        "preview_images": normalize_string_list(article.preview_images),
        "detail_url": article.detail_url,
        "size": article.size,
        "section": article.section,
        "category": article.category,
        "website": article.website,
        "create_time": article.create_time,
        "update_time": article.update_time,
    }


def _adapt_value_for_column(value, column):
    if isinstance(value, list):
        if isinstance(column.type, ARRAY):
            return value
        if not value:
            return None
        if column.name == "preview_images":
            return ",".join(value)
        return value[0] if len(value) == 1 else ",".join(value)
    return value


def get_transfer_target_config(db: Session):
    return success(_load_saved_target_config(db))


def save_transfer_target_config(db: Session, payload: TransferTargetPayload):
    data = _normalize_target_payload(payload)
    validation_error = _validate_connection_payload(data, require_table=False)
    if validation_error:
        return validation_error

    return save_option(
        JsonPayload(
            key=ARTICLE_TRANSFER_TARGET_CONFIG_KEY,
            payload=data,
        ),
        db,
    )


def test_transfer_target_connection(payload: TransferTargetPayload):
    data = _normalize_target_payload(payload)
    validation_error = _validate_connection_payload(data, require_table=False)
    if validation_error:
        return validation_error

    engine = _create_external_engine(data)
    try:
        with engine.connect() as connection:
            connection.execute(select(1))
        return success(
            {
                "connected": True,
                "database": data["database"],
                "schema": data["schema"],
            }
        )
    except SQLAlchemyError as exc:
        return error(str(exc))
    finally:
        engine.dispose()


def list_transfer_tables(payload: TransferTargetPayload):
    data = _normalize_target_payload(payload)
    validation_error = _validate_connection_payload(data, require_table=False)
    if validation_error:
        return validation_error

    engine = _create_external_engine(data)
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names(schema=data["schema"])
        return success(
            {
                "schema": data["schema"],
                "tables": tables,
            }
        )
    except SQLAlchemyError as exc:
        return error(str(exc))
    finally:
        engine.dispose()


def transfer_articles(db: Session):
    data = _load_saved_target_config(db)
    validation_error = _validate_connection_payload(data, require_table=True)
    if validation_error:
        return validation_error

    source_articles = db.query(Article).order_by(Article.id.asc()).all()
    if not source_articles:
        return success(
            {
                "table": data["table"],
                "schema": data["schema"],
                "total": 0,
                "inserted": 0,
                "skipped": 0,
            },
            message="no source articles",
        )

    engine = _create_external_engine(data)
    inserted = 0
    skipped = 0

    try:
        with engine.begin() as connection:
            target_table = _get_target_table(connection, data["schema"], data["table"])
            missing_columns = _get_missing_columns(target_table)
            if missing_columns:
                return error(
                    f"target table is missing required columns: {', '.join(missing_columns)}"
                )

            serialized_articles = [_serialize_article(article) for article in source_articles]
            for batch in _chunked(serialized_articles, 200):
                pairs = [(item["website"], item["tid"]) for item in batch]
                existing_pairs = set()
                if "website" in target_table.c and "tid" in target_table.c:
                    existing_pairs = set(
                        connection.execute(
                            select(target_table.c.website, target_table.c.tid).where(
                                tuple_(target_table.c.website, target_table.c.tid).in_(pairs)
                            )
                        ).all()
                    )

                pending = [
                    item
                    for item in batch
                    if (item["website"], item["tid"]) not in existing_pairs
                ]
                skipped += len(batch) - len(pending)

                if not pending:
                    continue

                rows = []
                for item in pending:
                    row = {}
                    for field in TRANSFER_FIELDS:
                        column = target_table.c[field]
                        row[field] = _adapt_value_for_column(item[field], column)
                    rows.append(row)

                connection.execute(target_table.insert(), rows)
                inserted += len(rows)

        return success(
            {
                "schema": data["schema"],
                "table": data["table"],
                "total": len(source_articles),
                "inserted": inserted,
                "skipped": skipped,
            },
            message="transfer completed",
        )
    except SQLAlchemyError as exc:
        return error(str(exc))
    finally:
        engine.dispose()
