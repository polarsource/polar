"""Fix ended past due subscriptions

Revision ID: 718f3b9ee0f5
Revises: d5f2b8e1c3a9
Create Date: 2026-06-17 14:48:03.099828

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "718f3b9ee0f5"
down_revision = "d5f2b8e1c3a9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Repair subscriptions whose dunning pipeline overwrote their terminal
    # `canceled` status with `past_due` after `ended_at` was set.
    op.execute(
        """
        UPDATE subscriptions
            SET status = 'canceled'
            WHERE status = 'past_due'
              AND ended_at IS NOT NULL
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    pass
