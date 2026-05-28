"""widen refunds amounts to bigint

Revision ID: d652417d5266
Revises: 8f4d6b9a2c31
Create Date: 2026-05-28 08:41:05.146185

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d652417d5266"
down_revision = "8f4d6b9a2c31"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "refunds",
        "amount",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )
    op.alter_column(
        "refunds",
        "tax_amount",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "refunds",
        "tax_amount",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
    op.alter_column(
        "refunds",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
