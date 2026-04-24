"""add receipt columns to orders and customers

Revision ID: 5d9e4c1f2a3b
Revises: ead15547bea8
Create Date: 2026-04-24 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5d9e4c1f2a3b"
down_revision = "ead15547bea8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "orders",
        sa.Column("receipt_number", sa.String(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("receipt_path", sa.String(), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column(
            "receipt_next_number",
            sa.Integer(),
            server_default="1",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("customers", "receipt_next_number")
    op.drop_column("orders", "receipt_path")
    op.drop_column("orders", "receipt_number")
