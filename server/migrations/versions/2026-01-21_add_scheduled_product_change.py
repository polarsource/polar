"""Add scheduled product change to subscriptions

Revision ID: a1b2c3d4e5f6
Revises: 69ef1626e8db
Create Date: 2026-01-21

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "69ef1626e8db"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column(
            "scheduled_change_product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_subscriptions_scheduled_change_product_id",
        "subscriptions",
        ["scheduled_change_product_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_subscriptions_scheduled_change_product_id", table_name="subscriptions"
    )
    op.drop_column("subscriptions", "scheduled_change_product_id")
