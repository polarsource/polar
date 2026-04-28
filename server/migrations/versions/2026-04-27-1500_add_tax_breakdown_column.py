"""add tax_breakdown column to orders, checkouts and wallet_transactions

Revision ID: f3a2b1c4d5e6
Revises: fe139a04f807
Create Date: 2026-04-24 15:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3a2b1c4d5e6"
down_revision = "fe139a04f807"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )
    op.add_column(
        "checkouts",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )
    op.add_column(
        "wallet_transactions",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("wallet_transactions", "tax_breakdown")
    op.drop_column("checkouts", "tax_breakdown")
    op.drop_column("orders", "tax_breakdown")
