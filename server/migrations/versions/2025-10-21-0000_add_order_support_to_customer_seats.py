"""add order support to customer seats

Revision ID: 902dd5c6c2b7
Revises: e3554bca67c8
Create Date: 2025-10-21 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "902dd5c6c2b7"
down_revision = "e3554bca67c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Step 1: Make subscription_id nullable in customer_seats
    op.alter_column(
        "customer_seats",
        "subscription_id",
        existing_type=sa.UUID(),
        nullable=True,
    )

    # Step 2: Add order_id column to customer_seats
    op.add_column(
        "customer_seats",
        sa.Column(
            "order_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    # Step 3: Add foreign key constraint for order_id
    op.create_foreign_key(
        "customer_seats_order_id_fkey",
        "customer_seats",
        "orders",
        ["order_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Step 4: Create index on order_id
    op.create_index(
        "ix_customer_seats_order_id",
        "customer_seats",
        ["order_id"],
    )

    # Step 5: Add check constraint to ensure exactly one of subscription_id or order_id is set
    op.create_check_constraint(
        "seat_source_check",
        "customer_seats",
        "(subscription_id IS NOT NULL AND order_id IS NULL) OR (subscription_id IS NULL AND order_id IS NOT NULL)",
    )

    # Step 6: Add seats column to orders table
    op.add_column(
        "orders",
        sa.Column("seats", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    # Step 6: Remove seats column from orders
    op.drop_column("orders", "seats")

    # Step 5: Drop check constraint
    op.drop_constraint("seat_source_check", "customer_seats", type_="check")

    # Step 4: Drop index on order_id
    op.drop_index("ix_customer_seats_order_id", "customer_seats")

    # Step 3: Drop foreign key constraint
    op.drop_constraint(
        "customer_seats_order_id_fkey", "customer_seats", type_="foreignkey"
    )

    # Step 2: Remove order_id column
    op.drop_column("customer_seats", "order_id")

    # Step 1: Make subscription_id non-nullable again
    op.alter_column(
        "customer_seats",
        "subscription_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
