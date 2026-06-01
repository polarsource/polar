"""Make order.invoice_number nullable for draft orders

Revision ID: d2a49dc19a62
Revises: b7b69a5d5731
Create Date: 2026-05-27 17:05:07.479671

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d2a49dc19a62"
down_revision = "b7b69a5d5731"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "orders", "invoice_number", existing_type=sa.VARCHAR(), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "orders", "invoice_number", existing_type=sa.VARCHAR(), nullable=False
    )
