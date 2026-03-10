"""Add refunds_blocked_until to Organization

Revision ID: 8a2e1f3b5c7d
Revises: df00cf8b34e1
Create Date: 2026-03-10 00:01:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8a2e1f3b5c7d"
down_revision = "df00cf8b34e1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "refunds_blocked_until",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "refunds_blocked_until")
