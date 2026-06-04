"""add max_redemptions_per_customer to discounts

Revision ID: b7e3f9a21c84
Revises: 0c12d2aaab31
Create Date: 2026-05-29 06:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b7e3f9a21c84"
down_revision = "0c12d2aaab31"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "discounts",
        sa.Column("max_redemptions_per_customer", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("discounts", "max_redemptions_per_customer")
