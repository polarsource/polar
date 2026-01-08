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
down_revision = "3c48bf325744"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("discount_applied_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    # Backfill discount_applied_at for existing subscriptions with discounts
    # by finding the first order that used the discount
    op.execute(
        """
        UPDATE subscriptions s
        SET discount_applied_at = o.created_at
        FROM (
            SELECT DISTINCT ON (o.subscription_id, o.discount_id)
                o.subscription_id,
                o.discount_id,
                o.created_at
            FROM orders o
            WHERE o.subscription_id IS NOT NULL
              AND o.discount_id IS NOT NULL
              AND o.deleted_at IS NULL
            ORDER BY o.subscription_id, o.discount_id, o.created_at ASC
        ) o
        WHERE s.id = o.subscription_id
          AND s.discount_id = o.discount_id
        """
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "discount_applied_at")
