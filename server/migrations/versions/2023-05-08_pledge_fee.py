"""pledge fee

Revision ID: b0fdb9018521
Revises: 5df98006e026
Create Date: 2023-05-08 09:21:27.752744

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b0fdb9018521"
down_revision = "5df98006e026"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("pledges", sa.Column("fee", sa.BigInteger(), nullable=True))
    op.execute("UPDATE pledges SET fee = 0")
    op.alter_column("pledges", "fee", nullable=False)


def downgrade() -> None:
    op.drop_column("pledges", "fee")
