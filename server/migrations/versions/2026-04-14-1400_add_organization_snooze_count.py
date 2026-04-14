"""add organization snooze_count column

Revision ID: 3da90b684726
Revises: 87c3805dd60f
Create Date: 2026-04-14 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3da90b684726"
down_revision = "87c3805dd60f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "organizations",
        sa.Column(
            "snooze_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "snooze_count")
