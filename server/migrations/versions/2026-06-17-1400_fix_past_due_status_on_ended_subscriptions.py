"""Fix past_due status on ended subscriptions

Revision ID: 5b8d2e6a3c91
Revises: c4e1a9f3b2d7
Create Date: 2026-06-17 14:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5b8d2e6a3c91"
down_revision = "c4e1a9f3b2d7"
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

    # Data-repair migration — the prior state cannot be reconstructed.
    pass
