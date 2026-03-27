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
    expire_on_commit=False,
)

Base = declarative_base()


def _normalize_config_schema(connection):
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


def _normalize_article_schema(connection):
    connection.execute(
        text(
            """
            DO $$
            DECLARE
                magnet_type text;
                edk_type text;
                preview_type text;
            BEGIN
                EXECUTE $sql$
                    ALTER TABLE sht.article
                    DROP COLUMN IF EXISTS archive_attachment_urls,
                    DROP COLUMN IF EXISTS archive_attachment_names,
                    DROP COLUMN IF EXISTS archive_parse_status
                $sql$;

                SELECT data_type INTO magnet_type
                FROM information_schema.columns
                WHERE table_schema = 'sht'
                  AND table_name = 'article'
                  AND column_name = 'magnet';

                SELECT data_type INTO edk_type
                FROM information_schema.columns
                WHERE table_schema = 'sht'
                  AND table_name = 'article'
                  AND column_name = 'edk';

                SELECT data_type INTO preview_type
                FROM information_schema.columns
                WHERE table_schema = 'sht'
                  AND table_name = 'article'
                  AND column_name = 'preview_images';

                IF magnet_type IS NOT NULL AND magnet_type <> 'ARRAY' THEN
                    EXECUTE $sql$
                        ALTER TABLE sht.article
                        ALTER COLUMN magnet TYPE text[]
                        USING CASE
                            WHEN magnet IS NULL OR btrim(magnet) = '' THEN ARRAY[]::text[]
                            WHEN left(magnet, 1) = '{' AND right(magnet, 1) = '}' THEN magnet::text[]
                            ELSE ARRAY[magnet]
                        END
                    $sql$;
                END IF;

                IF edk_type IS NOT NULL AND edk_type <> 'ARRAY' THEN
                    EXECUTE $sql$
                        ALTER TABLE sht.article
                        ALTER COLUMN edk TYPE text[]
                        USING CASE
                            WHEN edk IS NULL OR btrim(edk) = '' THEN ARRAY[]::text[]
                            WHEN left(edk, 1) = '{' AND right(edk, 1) = '}' THEN edk::text[]
                            ELSE ARRAY[edk]
                        END
                    $sql$;
                END IF;

                IF preview_type IS NOT NULL AND preview_type <> 'ARRAY' THEN
                    EXECUTE $sql$
                        ALTER TABLE sht.article
                        ALTER COLUMN preview_images TYPE text[]
                        USING CASE
                            WHEN preview_images IS NULL OR btrim(preview_images) = '' THEN ARRAY[]::text[]
                            WHEN left(preview_images, 1) = '{' AND right(preview_images, 1) = '}' THEN preview_images::text[]
                            ELSE array_remove(string_to_array(preview_images, ','), '')
                        END
                    $sql$;
                END IF;

                EXECUTE $sql$
                    ALTER TABLE sht.article
                    ALTER COLUMN magnet SET DEFAULT ARRAY[]::text[],
                    ALTER COLUMN edk SET DEFAULT ARRAY[]::text[],
                    ALTER COLUMN preview_images SET DEFAULT ARRAY[]::text[]
                $sql$;
            END $$;
            """
        )
    )


def _normalize_crawl_issue_schema(connection):
    connection.execute(
        text(
            """
            DO $$
            BEGIN
                ALTER TABLE sht.crawl_issue
                ADD COLUMN IF NOT EXISTS password_candidates text[] NOT NULL DEFAULT ARRAY[]::text[];
            END $$;
            """
        )
    )


def _normalize_database_schema(connection):
    if connection.dialect.name != "postgresql":
        return

    _normalize_config_schema(connection)
    _normalize_article_schema(connection)
    _normalize_crawl_issue_schema(connection)


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
    except SQLAlchemyError as exc:
        logger.error(f"数据库操作失败：{str(exc)}")
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
    except SQLAlchemyError as exc:
        logger.error(f"数据库操作失败：{str(exc)}")
        raise
    finally:
        if session.is_active:
            session.expunge_all()
            session.close()
