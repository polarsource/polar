"""widen disputes amounts to bigint

Revision ID: 10b4f3608e4f
Revises: 35e9e6992886
Create Date: 2026-06-01 14:02:31.680817

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "10b4f3608e4f"
down_revision = "35e9e6992886"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '2s'")
    op.alter_column(
        "disputes",
        "amount",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )
    op.alter_column(
        "disputes",
        "tax_amount",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '2s'")
    # WARNING: Rolling back will FAIL if any disputes.amount or tax_amount value
    # exceeds INTEGER max (2,147,483,647). Check data before downgrading.
    op.alter_column(
        "disputes",
        "tax_amount",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
    op.alter_column(
        "disputes",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
