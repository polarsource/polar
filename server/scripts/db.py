import os
import re
import subprocess

import typer
from alembic.command import upgrade as alembic_upgrade
from alembic.config import Config
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.config import settings

cli = typer.Typer()


def get_sync_postgres_dsn() -> str:
    # Escape %-encoding signs to avoid Alembic treating them as interpolation markers
    return settings.get_postgres_dsn("psycopg2").replace("%", "%%")


def get_config() -> Config:
    config_file = os.path.join(os.path.dirname(__file__), "../alembic.ini")
    config = Config(config_file)
    config.set_main_option("sqlalchemy.url", get_sync_postgres_dsn())
    return config


def _reparent(force: bool = False) -> None:
    # 1. Find which alembic head is on `main`
    # `alembic heads`
    p_out = subprocess.run(
        ["uv", "run", "alembic", "heads"],
        capture_output=True,
        text=True,
    )
    p_out.check_returncode()
    heads = set(
        [line.removesuffix(" (head)") for line in p_out.stdout.strip().split("\n")]
    )

    if force:
        pass
    elif len(heads) == 1:
        print("Found just 1 head, so there shouldn't be a need to reparent. Exiting")
        return
    elif len(heads) > 2:
        print("Found more than 2 heads unclear what we should do. Exiting")
        return

    main_head = None
    branch_head = None
    main_migration_file = None
    branch_migration_file = None
    for head in heads:
        # `git grep {head} main -- "server/migrations/versions/*"`
        p_out = subprocess.run(
            ["git", "grep", "-l", head, "main", "--", "migrations/versions/*"],
            capture_output=True,
            text=True,
        )
        if p_out.returncode == 0:
            main_head = head
            main_migration_file = p_out.stdout.strip().removeprefix("main:")

    if main_head:
        heads.remove(main_head)

    for head in heads:
        # `git grep {head} HEAD -- "server/migrations/versions/*"`
        p_out = subprocess.run(
            ["git", "grep", "-l", head, "HEAD", "--", "migrations/versions/*"],
            capture_output=True,
            text=True,
        )
        if p_out.returncode == 0:
            branch_head = head
            branch_migration_file = p_out.stdout.strip().removeprefix("HEAD:")

    if (
        not main_head
        or not branch_head
        or not main_migration_file
        or not branch_migration_file
    ):
        return

    print(f"""
`main` head: {main_head} ({main_migration_file})
branch head: {branch_head} ({branch_migration_file})
""")

    re_down_revision = re.compile(r'down_revision = "([^"]+)"')

    # 2. Manipulate the other head to be based off head from `main`-branch
    with open(branch_migration_file, "r+") as f:
        f_contents = f.read()

        previous_parent = list(re_down_revision.finditer(f_contents))[0].group(1)
        f_new_contents = re_down_revision.sub(
            f'down_revision = "{main_head}"', f_contents
        )
        f_new_contents = re.sub(
            "Revises: [a-f0-9]+", f"Revises: {main_head}", f_new_contents
        )

        print(f"Updating {branch_migration_file}")
        print(f'`down_revision` was "{previous_parent}"')
        print(f'`down_revision` updated to "{main_head}"')
        f.seek(0)
        f.write(f_new_contents)


def _upgrade(revision: str = "head") -> None:
    config = get_config()
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


@cli.command(
    help="Try to move a conflicting head migration on the current branch on top o fthe latest migration on `main`"
)
def reparent(
    force: bool = typer.Option(
        False,
        "-f",
        "--force",
        help="Update latest migration even if there aren't multiple heads",
    ),
) -> None:
    _reparent(force=force)


def assert_dev_or_testing() -> None:
    if not (settings.is_development() or settings.is_testing()):
        raise RuntimeError(f"DANGER! You cannot run this script in {settings.ENV}!")


if __name__ == "__main__":
    cli()
