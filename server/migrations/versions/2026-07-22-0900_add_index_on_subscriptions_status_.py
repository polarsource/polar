"""add index on subscriptions status current_period_end

Revision ID: b7e2d4a9c1f3
Revises: a1c2f95b7d31
Create Date: 2026-07-22 09:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b7e2d4a9c1f3"
down_revision = "a1c2f95b7d31"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_subscriptions_status_current_period_end"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "subscriptions",
            ["status", "current_period_end"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
