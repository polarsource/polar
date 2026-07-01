"""add subscription pause fields

Revision ID: d0dce7d10526
Revises: 31d662178679
Create Date: 2026-07-01 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d0dce7d10526"
down_revision = "31d662178679"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "subscriptions",
        sa.Column(
            "pause_at_period_end",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column("paused_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("subscriptions", "paused_at")
    op.drop_column("subscriptions", "pause_at_period_end")
