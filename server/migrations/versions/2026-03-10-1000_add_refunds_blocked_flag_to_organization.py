"""Add refunds_blocked flag to Organization

Revision ID: df00cf8b34e1
Revises: a1fd4341cf14
Create Date: 2026-03-07 20:27:50.611316

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "df00cf8b34e1"
down_revision = "a1fd4341cf14"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Step 1: Add refunds_blocked column as nullable
    op.add_column(
        "organizations",
        sa.Column("refunds_blocked", sa.Boolean(), nullable=True),
    )

    # Step 2: Set default value for existing rows
    op.execute(
        "UPDATE organizations SET refunds_blocked = false WHERE refunds_blocked IS NULL"
    )

    # Step 3: Make the column non-nullable
    op.alter_column("organizations", "refunds_blocked", nullable=False)


def downgrade() -> None:
    # Remove refunds_blocked column from organizations table
    op.drop_column("organizations", "refunds_blocked")
