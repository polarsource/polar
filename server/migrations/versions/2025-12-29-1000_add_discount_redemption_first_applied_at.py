"""Add discount_applied_at to subscriptions

Revision ID: 9d5e6f7a8b9c
Revises: 8c4a2b3d5e6f
Create Date: 2025-12-29 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9d5e6f7a8b9c"
down_revision = "8c4a2b3d5e6f"
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
    # and have already had it applied to a billing entry
    op.execute("""
        UPDATE subscriptions s
        SET discount_applied_at = be.created_at
        FROM (
            SELECT DISTINCT ON (be.subscription_id, be.discount_id)
                be.subscription_id,
                be.discount_id,
                be.created_at
            FROM billing_entries be
            WHERE be.discount_id IS NOT NULL
              AND be.deleted_at IS NULL
            ORDER BY be.subscription_id, be.discount_id, be.created_at ASC
        ) be
        WHERE s.id = be.subscription_id
          AND s.discount_id = be.discount_id
    """)


def downgrade() -> None:
    op.drop_column("subscriptions", "discount_applied_at")
