from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.schema import CreateSchema

from app.core import settings
from app.utils.log import logger

engine = create_engine(settings.DATABASE_URL, echo=True)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

Base = declarative_base()

ARTICLE_SCHEMA = "sht"
ARTICLE_TABLE = "article"
ARTICLE_ARRAY_COLUMNS = {
    "magnet": False,
    "preview_images": True,
    "edk": False,
}


def _get_column_udt_name(connection, schema_name: str, table_name: str, column_name: str):
    return connection.execute(
        text(
            """
            SELECT udt_name
            FROM information_schema.columns
            WHERE table_schema = :schema_name
              AND table_name = :table_name
              AND column_name = :column_name
            """
        ),
        {
            "schema_name": schema_name,
            "table_name": table_name,
            "column_name": column_name,
        },
    ).scalar()


def _ensure_article_text_column(connection, column_name: str):
    if not _get_column_udt_name(connection, ARTICLE_SCHEMA, ARTICLE_TABLE, column_name):
        return

    connection.execute(
        text(
            f'''
            ALTER TABLE "{ARTICLE_SCHEMA}"."{ARTICLE_TABLE}"
            ALTER COLUMN "{column_name}" TYPE TEXT
            '''
        )
    )


def _ensure_article_array_column(
    connection,
    column_name: str,
    *,
    split_commas: bool = False,
):
    if not _get_column_udt_name(connection, ARTICLE_SCHEMA, ARTICLE_TABLE, column_name):
        return

    using_expression = (
        f"""
        CASE
            WHEN "{column_name}" IS NULL OR btrim("{column_name}") = '' THEN ARRAY[]::TEXT[]
            WHEN left("{column_name}", 1) = '{{' AND right("{column_name}", 1) = '}}' THEN "{column_name}"::TEXT[]
            ELSE array_remove(regexp_split_to_array("{column_name}", E'\\s*,\\s*'), '')
        END
        """
        if split_commas
        else f"""
        CASE
            WHEN "{column_name}" IS NULL OR btrim("{column_name}") = '' THEN ARRAY[]::TEXT[]
            WHEN left("{column_name}", 1) = '{{' AND right("{column_name}", 1) = '}}' THEN "{column_name}"::TEXT[]
            ELSE ARRAY["{column_name}"]
        END
        """
    )

    if _get_column_udt_name(connection, ARTICLE_SCHEMA, ARTICLE_TABLE, column_name) != "_text":
        connection.execute(
            text(
                f'''
                ALTER TABLE "{ARTICLE_SCHEMA}"."{ARTICLE_TABLE}"
                ALTER COLUMN "{column_name}" TYPE TEXT[] USING {using_expression}
                '''
            )
        )

    connection.execute(
        text(
            f'''
            UPDATE "{ARTICLE_SCHEMA}"."{ARTICLE_TABLE}"
            SET "{column_name}" = ARRAY[]::TEXT[]
            WHERE "{column_name}" IS NULL
            '''
        )
    )
    connection.execute(
        text(
            f'''
            ALTER TABLE "{ARTICLE_SCHEMA}"."{ARTICLE_TABLE}"
            ALTER COLUMN "{column_name}" SET DEFAULT ARRAY[]::TEXT[],
            ALTER COLUMN "{column_name}" SET NOT NULL
            '''
        )
    )


def _normalize_database_schema(connection):
    if connection.dialect.name != "postgresql":
        return

    connection.execute(
        text(
            """
            DO $$
            DECLARE
                constraint_name text;
            BEGIN
                SELECT c.conname
                INTO constraint_name
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
                WHERE c.contype = 'u'
                  AND n.nspname = 'sht'
                  AND t.relname = 'config'
                  AND a.attname = 'content'
                LIMIT 1;

                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE sht.config DROP CONSTRAINT %I', constraint_name);
                END IF;
            END $$;
            """
        )
    )

    if connection.execute(text("SELECT to_regclass('sht.article')")).scalar():
        _ensure_article_text_column(connection, "title")
        _ensure_article_text_column(connection, "detail_url")
        for column_name, split_commas in ARTICLE_ARRAY_COLUMNS.items():
            _ensure_article_array_column(
                connection,
                column_name,
                split_commas=split_commas,
            )


def init_database():
    schema_names = sorted(
        {
            table.schema
            for table in Base.metadata.tables.values()
            if table.schema
        }
    )

    with engine.begin() as connection:
        for schema_name in schema_names:
            connection.execute(CreateSchema(schema_name, if_not_exists=True))
        Base.metadata.create_all(bind=connection)
        _normalize_database_schema(connection)


@contextmanager
def session_scope() -> Generator:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        logger.error(f"数据库操作失败：{str(e)}")
        raise
    finally:
        if session.is_active:
            session.expunge_all()
            session.close()


def get_db():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except SQLAlchemyError as e:
        logger.error(f"数据库操作失败：{str(e)}")
        raise
    finally:
        if session.is_active:
            session.expunge_all()
            session.close()
