"""Add discount_applied_at to subscriptions

Revision ID: ea11a3dc85a2
Revises: 3d212567b9a6
Create Date: 2026-01-06 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ea11a3dc85a2"
down_revision = "3d212567b9a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("discount_applied_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "discount_applied_at")
