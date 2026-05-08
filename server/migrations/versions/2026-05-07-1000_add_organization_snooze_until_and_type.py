"""add organization snoozed_until + snooze_type columns

Revision ID: 9b1f3a4c2d8e
Revises: 01607ddf3d7f
Create Date: 2026-05-07 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9b1f3a4c2d8e"
down_revision = "01607ddf3d7f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "organizations",
        sa.Column(
            "snoozed_until",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "snooze_type",
            sa.String(),
            nullable=True,
        ),
    )

    # Backfill existing snoozed organizations to preserve current behavior
    # (re-review on next sale 24h after the snooze took effect).
    op.execute(
        """
        UPDATE organizations
        SET
            snoozed_until = COALESCE(status_updated_at, NOW()) + INTERVAL '24 hours',
            snooze_type = 'next_sale'
        WHERE status = 'snoozed'
        """
    )


def downgrade() -> None:
    op.drop_column("organizations", "snooze_type")
    op.drop_column("organizations", "snoozed_until")
