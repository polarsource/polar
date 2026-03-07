"""Add refunds_blocked flag to Organization

Revision ID: df00cf8b34e1
Revises: 22e0e20d2455
Create Date: 2026-03-07 20:27:50.611316

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "df00cf8b34e1"
down_revision = "22e0e20d2455"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add refunds_blocked column to organizations table
    op.add_column(
        "organizations",
        sa.Column(
            "refunds_blocked", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    # Remove refunds_blocked column from organizations table
    op.drop_column("organizations", "refunds_blocked")
