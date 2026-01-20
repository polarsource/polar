"""Backfill minimum_amount for custom prices

Revision ID: 5f8e2a3b4c6d
Revises: 3a7b8c9d0e1f
Create Date: 2026-01-20

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5f8e2a3b4c6d"
down_revision = "3a7b8c9d0e1f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Backfill minimum_amount=50 for existing custom prices that have NULL
    # This makes the API non-nullable while keeping the DB column nullable
    # (due to polymorphism - other price types don't use this field)
    op.execute(
        """
        UPDATE product_prices
        SET minimum_amount = 50
        WHERE amount_type = 'custom' AND minimum_amount IS NULL
        """
    )


def downgrade() -> None:
    # No downgrade needed - NULL and 50 have the same effective behavior
    # in the legacy code, so we don't need to revert the data
    pass
