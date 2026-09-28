"""index oauth2_states expires_at

Revision ID: 6b92cf7d539b
Revises: 01a1245dc86e
Create Date: 2026-09-21 08:46:42.507984

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6b92cf7d539b"
down_revision = "01a1245dc86e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_oauth2_states_expires_at"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # CREATE INDEX CONCURRENTLY waits for every concurrent transaction in the
        # database to finish, whatever table it touches, so it needs far more
        # headroom than the 5s we use for lock-taking DDL.
        op.execute("SET lock_timeout = '5min'")
        try:
            # Drop any INVALID leftover from an interrupted concurrent build first.
            op.drop_index(
                INDEX_NAME,
                table_name="oauth2_states",
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                INDEX_NAME,
                "oauth2_states",
                ["expires_at"],
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="oauth2_states",
                postgresql_concurrently=True,
                if_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")
