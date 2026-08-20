"""add units columns for unit-based pricing

Revision ID: a83cf131398d
Revises: c7f2a91e4d38
Create Date: 2026-08-18 19:43:52.198677

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a83cf131398d"
down_revision = "c7f2a91e4d38"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("checkouts", sa.Column("units", sa.Integer(), nullable=True))
    op.add_column("checkouts", sa.Column("min_units", sa.Integer(), nullable=True))
    op.add_column("checkouts", sa.Column("max_units", sa.Integer(), nullable=True))
    op.add_column("checkout_links", sa.Column("units", sa.Integer(), nullable=True))
    op.add_column("subscriptions", sa.Column("units", sa.Integer(), nullable=True))
    op.add_column(
        "subscription_updates", sa.Column("units", sa.Integer(), nullable=True)
    )
    op.add_column("orders", sa.Column("units", sa.Integer(), nullable=True))
    op.add_column(
        "product_prices",
        sa.Column(
            "unit_label",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("product_prices", "unit_label")
    op.drop_column("orders", "units")
    op.drop_column("subscription_updates", "units")
    op.drop_column("subscriptions", "units")
    op.drop_column("checkout_links", "units")
    op.drop_column("checkouts", "max_units")
    op.drop_column("checkouts", "min_units")
    op.drop_column("checkouts", "units")
