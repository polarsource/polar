"""add index for closest recorded payment exchange rate

Revision ID: 76c870dc15ed
Revises: 43bfb6e78c72
Create Date: 2026-09-25 09:09:16.306794

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "76c870dc15ed"
down_revision = "43bfb6e78c72"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEX_NAME = "ix_transactions_recorded_payment_rate"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Recover an invalid index left by an interrupted concurrent build.
            op.drop_index(
                INDEX_NAME,
                table_name="transactions",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "transactions",
                [
                    sa.literal_column("lower(currency)"),
                    sa.literal_column("lower(presentment_currency)"),
                    "created_at",
                ],
                unique=False,
                postgresql_where=sa.text(
                    "type = 'payment' AND exchange_rate IS NOT NULL"
                ),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="transactions",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
