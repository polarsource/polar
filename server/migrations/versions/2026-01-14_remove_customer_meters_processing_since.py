"""Remove Customer.meters_processing_since

Revision ID: 9c8d7e6f5a4b
Revises: ab473a734057
Create Date: 2026-01-14

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9c8d7e6f5a4b"
down_revision = "ab473a734057"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_customers_meters_processing_since"), table_name="customers")
    op.drop_column("customers", "meters_processing_since")


def downgrade() -> None:
    op.add_column(
        "customers",
        sa.Column(
            "meters_processing_since", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    op.create_index(
        op.f("ix_customers_meters_processing_since"),
        "customers",
        ["meters_processing_since"],
        unique=False,
    )
