"""add invoice_next_number to customers

Revision ID: 8c9ef8060e95
Revises: 9b0f38cdd25d
Create Date: 2025-10-24 09:15:38.708186

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8c9ef8060e95"
down_revision = "9b0f38cdd25d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("invoice_next_number", sa.Integer(), nullable=True),
    )
    op.execute(
        "UPDATE customers SET invoice_next_number = 1 WHERE invoice_next_number IS NULL"
    )
    op.alter_column("customers", "invoice_next_number", nullable=False)


def downgrade() -> None:
    op.drop_column("customers", "invoice_next_number")
