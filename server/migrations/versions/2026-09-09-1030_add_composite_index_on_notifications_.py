"""add composite index on notifications user_id created_at

Revision ID: a0bc64d272f1
Revises: f9cabfdff143
Create Date: 2026-09-09 10:30:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a0bc64d272f1"
down_revision = "f9cabfdff143"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

COMPOSITE_INDEX = "ix_notifications_user_id_created_at"
USER_ID_INDEX = "ix_notifications_user_id"


def upgrade() -> None:
    # GET /v1/notifications runs `WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`.
    # With only single-column indexes the planner scans ix_notifications_created_at
    # backwards and filters by user_id, which degrades badly for users with many
    # notifications. This composite lets the query jump straight to the user's rows
    # already ordered by created_at (Postgres scans a plain btree backwards for the
    # DESC LIMIT). Built CONCURRENTLY to avoid locking the table.
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            COMPOSITE_INDEX,
            table_name="notifications",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            COMPOSITE_INDEX,
            "notifications",
            ["user_id", "created_at"],
            unique=False,
            postgresql_concurrently=True,
        )
        # The composite covers `user_id = ?` lookups too, so the single-column index
        # is now redundant; drop it to avoid the dead-index write overhead.
        op.drop_index(
            USER_ID_INDEX,
            table_name="notifications",
            if_exists=True,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            USER_ID_INDEX,
            table_name="notifications",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            USER_ID_INDEX,
            "notifications",
            ["user_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.drop_index(
            COMPOSITE_INDEX,
            table_name="notifications",
            if_exists=True,
            postgresql_concurrently=True,
        )
