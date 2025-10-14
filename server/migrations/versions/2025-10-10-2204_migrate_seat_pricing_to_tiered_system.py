"""migrate seat pricing to tiered system

Revision ID: 6d3526688821
Revises: 243749b0ceed
Create Date: 2025-10-10 22:04:27.405580

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6d3526688821"
down_revision = "243749b0ceed"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add seat_tiers JSONB column
    op.add_column(
        "product_prices",
        sa.Column("seat_tiers", sa.dialects.postgresql.JSONB(), nullable=True),
    )

    # Migrate existing price_per_seat data to seat_tiers format
    # Only for seat_based price types
    op.execute(
        """
        UPDATE product_prices
        SET seat_tiers = jsonb_build_object(
            'tiers', jsonb_build_array(
                jsonb_build_object(
                    'min_seats', 1,
                    'max_seats', NULL,
                    'price_per_seat', price_per_seat
                )
            )
        )
        WHERE amount_type = 'seat_based'
        AND price_per_seat IS NOT NULL
        """
    )

    # Drop the old price_per_seat column
    op.drop_column("product_prices", "price_per_seat")


def downgrade() -> None:
    # Add back price_per_seat column
    op.add_column(
        "product_prices",
        sa.Column("price_per_seat", sa.Integer(), nullable=True),
    )

    # Migrate seat_tiers back to price_per_seat
    # Extract the first tier's price_per_seat value
    op.execute(
        """
        UPDATE product_prices
        SET price_per_seat = (seat_tiers->'tiers'->0->>'price_per_seat')::integer
        WHERE amount_type = 'seat_based'
        AND seat_tiers IS NOT NULL
        """
    )

    # Drop seat_tiers column
    op.drop_column("product_prices", "seat_tiers")
