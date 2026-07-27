"""add partial indexes for subscription scheduler queries

Revision ID: 915a09233568
Revises: 646c76720b00
Create Date: 2026-07-27 15:53:38.061059

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "915a09233568"
down_revision = "37f4ba372112"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

CYCLE_INDEX = "ix_subscriptions_cycle_schedule"
CYCLE_WHERE = (
    "scheduler_locked_at IS NULL "
    "AND status IN ('trialing', 'active') "
    "AND current_period_end IS NOT NULL"
)

RESUME_INDEX = "ix_subscriptions_resume_schedule"
RESUME_WHERE = (
    "scheduler_locked_at IS NULL AND status = 'paused' AND resumes_at IS NOT NULL"
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            CYCLE_INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            CYCLE_INDEX,
            "subscriptions",
            ["current_period_end"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text(CYCLE_WHERE),
        )

        op.drop_index(
            RESUME_INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            RESUME_INDEX,
            "subscriptions",
            ["resumes_at"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text(RESUME_WHERE),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            CYCLE_INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.drop_index(
            RESUME_INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
