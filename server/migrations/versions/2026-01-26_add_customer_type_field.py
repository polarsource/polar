"""Add customer type field

Revision ID: 0d22a3046589
Revises: 7a8b9c0d1e2f
Create Date: 2026-01-26

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0d22a3046589"
down_revision = "7a8b9c0d1e2f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add type column as nullable
    op.add_column(
        "customers",
        sa.Column("type", sa.String(), nullable=True),
    )

    # Set all existing customers to 'individual' by default
    op.execute("UPDATE customers SET type = 'individual' WHERE type IS NULL")

    # Make the column non-nullable
    op.alter_column(
        "customers",
        "type",
        existing_type=sa.String(),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("customers", "type")
