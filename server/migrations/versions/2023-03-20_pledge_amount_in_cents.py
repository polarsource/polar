"""pledge amount in cents

Revision ID: eb8714b4b6ca
Revises: 401fef781277
Create Date: 2023-03-20 10:04:57.390744

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "eb8714b4b6ca"
down_revision = "401fef781277"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "pledges",
        "amount",
        existing_type=sa.NUMERIC(precision=25, scale=10),
        type_=sa.BigInteger(),
        existing_nullable=False,
    )
    op.execute("update pledges set amount = amount * 100")


def downgrade() -> None:
    op.alter_column(
        "pledges",
        "amount",
        existing_type=sa.BigInteger(),
        type_=sa.NUMERIC(precision=25, scale=10),
        existing_nullable=False,
    )
    op.execute("update pledges set amount = amount / 100")
