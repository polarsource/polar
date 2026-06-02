"""add metered_tiers to product_prices

Revision ID: f3a9c1e7b240
Revises: d2a49dc19a62
Create Date: 2026-06-02 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3a9c1e7b240"
down_revision = "d2a49dc19a62"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add metered_tiers JSONB column for volume/graduated tiered metered pricing.
    # Nullable: existing metered prices keep using the single unit_amount column.
    op.add_column(
        "product_prices",
        sa.Column(
            "metered_tiers",
            sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("product_prices", "metered_tiers")
