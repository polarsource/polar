"""widen subscription_meters amount to bigint

Revision ID: f2d8090bf7c2
Revises: f28bbb86dcf1
Create Date: 2026-05-27 15:40:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f2d8090bf7c2"
down_revision = "f28bbb86dcf1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "subscription_meters",
        "amount",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "subscription_meters",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
    )
