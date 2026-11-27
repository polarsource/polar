"""index foreign key lookup columns

Revision ID: 900a77da1283
Revises: 3f9c1a7e2b4d
Create Date: 2026-11-05 11:01:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "900a77da1283"
down_revision = "3f9c1a7e2b4d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEXES = (
    ("ix_checkouts_customer_id", "checkouts", "customer_id", "customer_id IS NOT NULL"),
    ("ix_checkouts_product_id", "checkouts", "product_id", "product_id IS NOT NULL"),
    ("ix_payout_accounts_admin_id", "payout_accounts", "admin_id", None),
    ("ix_payout_accounts_stripe_id", "payout_accounts", "stripe_id", None),
    ("ix_payout_attempts_payout_id", "payout_attempts", "payout_id", None),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, column, where in INDEXES:
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    name,
                    table,
                    [column],
                    postgresql_concurrently=True,
                    postgresql_where=where,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, _column, _where in INDEXES:
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")
