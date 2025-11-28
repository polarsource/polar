"""add dirty flag to customer

Revision ID: 856fff9b3dfe
Revises: f5223877acbb
Create Date: 2025-11-28 15:06:40.120064

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "856fff9b3dfe"
down_revision = "f5223877acbb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add dirty column with default False
    op.add_column(
        "customers",
        sa.Column("dirty", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Set dirty = TRUE where meters_dirtied_at IS NOT NULL
    op.execute(
        """
        UPDATE customers
        SET dirty = TRUE
        WHERE meters_dirtied_at IS NOT NULL
        """
    )

    # Create index on dirty column
    op.create_index(
        op.f("ix_customers_dirty"),
        "customers",
        ["dirty"],
        unique=False,
    )


def downgrade() -> None:
    # Drop index
    op.drop_index(op.f("ix_customers_dirty"), table_name="customers")

    # Drop column
    op.drop_column("customers", "dirty")
