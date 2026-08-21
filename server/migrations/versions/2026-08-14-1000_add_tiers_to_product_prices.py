"""add tiers to product prices

Revision ID: c7f2a91e4d38
Revises: f3d81c25ab90
Create Date: 2026-08-14 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c7f2a91e4d38"
down_revision = "f3d81c25ab90"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.add_column(
        "product_prices",
        sa.Column(
            "tiers",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "product_prices",
        sa.Column("minimum_units", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("maximum_units", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.drop_column("product_prices", "maximum_units")
    op.drop_column("product_prices", "minimum_units")
    op.drop_column("product_prices", "tiers")
