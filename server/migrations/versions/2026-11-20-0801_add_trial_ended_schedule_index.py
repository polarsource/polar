"""add partial index for the trial_ended subscription scheduler

Revision ID: f3238e76d766
Revises: 84205fdb9945
Create Date: 2026-11-20 08:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3238e76d766"
down_revision = "84205fdb9945"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_subscriptions_trial_ended_schedule"
WHERE = "scheduler_locked_at IS NULL AND status = 'trial_ended' AND ends_at IS NOT NULL"


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
            ["ends_at"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text(WHERE),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="subscriptions",
            if_exists=True,
            postgresql_concurrently=True,
        )
