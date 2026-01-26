"""Add max_redemptions_per_customer to discounts and customer_id to discount_redemptions

Revision ID: a5cf04221162
Revises: 7a8b9c0d1e2f
Create Date: 2026-01-26

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a5cf04221162"
down_revision = "7a8b9c0d1e2f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add max_redemptions_per_customer to discounts
    op.add_column(
        "discounts",
        sa.Column("max_redemptions_per_customer", sa.Integer(), nullable=True),
    )

    # Add customer_id to discount_redemptions
    op.add_column(
        "discount_redemptions",
        sa.Column("customer_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("discount_redemptions_customer_id_fkey"),
        "discount_redemptions",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_discount_redemptions_customer_id"),
        "discount_redemptions",
        ["customer_id"],
    )

    # Backfill customer_id from checkout
    op.execute("""
        UPDATE discount_redemptions dr
        SET customer_id = c.customer_id
        FROM checkouts c
        WHERE dr.checkout_id = c.id AND c.customer_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index(
        op.f("ix_discount_redemptions_customer_id"),
        table_name="discount_redemptions",
    )
    op.drop_constraint(
        op.f("discount_redemptions_customer_id_fkey"),
        "discount_redemptions",
        type_="foreignkey",
    )
    op.drop_column("discount_redemptions", "customer_id")
    op.drop_column("discounts", "max_redemptions_per_customer")
