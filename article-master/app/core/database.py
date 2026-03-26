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
