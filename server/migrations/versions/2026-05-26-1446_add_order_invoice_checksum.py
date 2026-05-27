"""Add Order.invoice_checksum

Revision ID: c89b877bd235
Revises: fc013555b132
Create Date: 2026-05-26 14:46:29.782222

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c89b877bd235"
down_revision = "dd1a9c1f39c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("invoice_checksum", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "invoice_checksum")
