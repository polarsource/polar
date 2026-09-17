"""add transaction account type covering index

Revision ID: 262ac540123d
Revises: d38387d01757
Create Date: 2026-09-17 16:17:26.766828

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "262ac540123d"
down_revision = "d38387d01757"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_transactions_account_type_amount"


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
                ["account_id", "type"],
                unique=False,
                postgresql_include=["amount"],
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
