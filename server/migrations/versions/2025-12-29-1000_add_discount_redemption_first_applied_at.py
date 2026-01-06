"""Add discount_applied_at to subscriptions

Revision ID: 9d5e6f7a8b9c
Revises: 3d212567b9a6
Create Date: 2025-12-29 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9d5e6f7a8b9c"
down_revision = "3d212567b9a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column(
            "discount_applied_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )

    # Backfill discount_applied_at for subscriptions that have a discount
    # and have already had it applied to an order
    op.execute("""
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
    """)


def downgrade() -> None:
    op.drop_column("subscriptions", "discount_applied_at")
