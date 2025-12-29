"""Add first_applied_at to discount_redemptions

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
        "discount_redemptions",
        sa.Column(
            "first_applied_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "discount_redemptions",
        sa.Column(
            "first_applied_billing_entry_id",
            sa.Uuid(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_discount_redemptions_first_applied_billing_entry",
        "discount_redemptions",
        "billing_entries",
        ["first_applied_billing_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Backfill first_applied_at for existing discount redemptions
    # that have already been applied to a billing entry
    op.execute("""
        UPDATE discount_redemptions dr
        SET
            first_applied_at = be.created_at,
            first_applied_billing_entry_id = be.id
        FROM (
            SELECT DISTINCT ON (be.subscription_id, be.discount_id)
                be.id,
                be.subscription_id,
                be.discount_id,
                be.created_at
            FROM billing_entries be
            WHERE be.discount_id IS NOT NULL
              AND be.deleted_at IS NULL
            ORDER BY be.subscription_id, be.discount_id, be.created_at ASC
        ) be
        WHERE dr.subscription_id = be.subscription_id
          AND dr.discount_id = be.discount_id
    """)


def downgrade() -> None:
    op.drop_constraint(
        "fk_discount_redemptions_first_applied_billing_entry",
        "discount_redemptions",
        type_="foreignkey",
    )
    op.drop_column("discount_redemptions", "first_applied_billing_entry_id")
    op.drop_column("discount_redemptions", "first_applied_at")
