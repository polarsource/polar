"""Rename Order.from_balance_amount to Order.applied_balance_amount

Revision ID: 5ab7f025ad1d
Revises: 47755db39a50
Create Date: 2025-09-30 15:59:56.941353

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5ab7f025ad1d"
down_revision = "47755db39a50"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "orders",
        "from_balance_amount",
        new_column_name="applied_balance_amount",
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=False,
    )

    # Update non-zero from_balance_amount values to be negative
    op.execute(
        """
        UPDATE orders
        SET applied_balance_amount = -applied_balance_amount
        WHERE applied_balance_amount > 0
        """
    )


def downgrade() -> None:
    # Update negative applied_balance_amount values back to positive
    op.execute(
        """
            UPDATE orders
            SET applied_balance_amount = -applied_balance_amount
            WHERE applied_balance_amount < 0
            """
    )

    op.alter_column(
        "orders",
        "applied_balance_amount",
        new_column_name="from_balance_amount",
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=False,
    )
