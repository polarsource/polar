"""Widen meters.custom_multiplier to BIGINT

Revision ID: 64d92ea66fa5
Revises: 10b4f3608e4f
Create Date: 2026-06-01 10:56:53.066327

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "64d92ea66fa5"
down_revision = "10b4f3608e4f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "meters",
        "custom_multiplier",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "meters",
        "custom_multiplier",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=True,
    )
