"""Add exchange_rate to transactions

Revision ID: eee9c7fb3595
Revises: b43b68670937
Create Date: 2026-02-10 14:21:43.201075

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_grant_table import PGGrantTable
from sqlalchemy import text as sql_text

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "eee9c7fb3595"
down_revision = "b43b68670937"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("exchange_rate", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transactions", "exchange_rate")
