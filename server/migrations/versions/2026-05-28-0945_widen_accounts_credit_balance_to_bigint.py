"""widen accounts credit_balance to bigint

Revision ID: 706d2bab5ee4
Revises: d652417d5266
Create Date: 2026-05-28 09:45:01.297852

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "706d2bab5ee4"
down_revision = "d652417d5266"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # accounts is read on hot auth/balance paths. Bound the ACCESS EXCLUSIVE
    # wait so a busy lock queue fails the migration fast instead of stalling
    # every concurrent query behind it.
    op.execute("SET lock_timeout = '2s'")
    op.alter_column(
        "accounts",
        "credit_balance",
        existing_type=sa.INTEGER(),
        type_=sa.BigInteger(),
        existing_nullable=False,
        existing_server_default=sa.text("0"),
    )


def downgrade() -> None:
    op.execute("SET lock_timeout = '2s'")
    op.alter_column(
        "accounts",
        "credit_balance",
        existing_type=sa.BigInteger(),
        type_=sa.INTEGER(),
        existing_nullable=False,
        existing_server_default=sa.text("0"),
    )
