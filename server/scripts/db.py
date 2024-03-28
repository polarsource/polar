import os

import typer
from alembic.command import upgrade as alembic_upgrade
from alembic.config import Config
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.config import settings

cli = typer.Typer()


def get_sync_postgres_dsn() -> str:
    return str(settings.get_postgres_dsn("psycopg2"))


def _upgrade(revision: str = "head") -> None:
    config_file = os.path.join(os.path.dirname(__file__), "../alembic.ini")
    config = Config(config_file)
    config.set_main_option("sqlalchemy.url", get_sync_postgres_dsn())
    alembic_upgrade(config, revision)


def _recreate() -> None:
    assert_dev_or_testing()

    if database_exists(get_sync_postgres_dsn()):
        drop_database(get_sync_postgres_dsn())

    create_database(get_sync_postgres_dsn())
    _upgrade("head")


@cli.command()
def upgrade(
    revision: str = typer.Option("head", help="Which revision to upgrade to"),
) -> None:
    _upgrade(revision)


@cli.command()
def recreate() -> None:
    assert_dev_or_testing()
    _recreate()


def assert_dev_or_testing() -> None:
    if not (settings.is_development() or settings.is_testing()):
        raise RuntimeError(f"DANGER! You cannot run this script in {settings.ENV}!")


if __name__ == "__main__":
    cli()
