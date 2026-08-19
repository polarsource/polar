"""store unit_label as localized jsonb

Revision ID: 87092f5cef58
Revises: a83cf131398d
Create Date: 2026-08-19 17:29:40.265326

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "87092f5cef58"
down_revision = "a83cf131398d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("product_prices", "unit_label_plural")
    op.drop_column("product_prices", "unit_label")
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
    op.add_column(
        "product_prices",
        sa.Column("unit_label", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("unit_label_plural", sa.String(length=32), nullable=True),
    )
