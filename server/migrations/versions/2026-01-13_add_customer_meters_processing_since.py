"""Add Customer.meters_processing_since

Revision ID: 3f4a5b6c7d8e
Revises: ea11a3dc85a2
Create Date: 2026-01-13

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3f4a5b6c7d8e"
down_revision = "ea11a3dc85a2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_index(op.f("ix_customers_meters_processing_since"), table_name="customers")
    op.drop_column("customers", "meters_processing_since")
