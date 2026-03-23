"""Add total_balance to organizations

Revision ID: 006a22ac6a34
Revises: 817c66202639
Create Date: 2026-03-19 16:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "006a22ac6a34"
down_revision = "817c66202639"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("total_balance", sa.BigInteger(), nullable=True, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("organizations", "total_balance")
