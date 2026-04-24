"""add partial unique index on (orders.customer_id, orders.receipt_number)

Revision ID: a9b8c7d6e5f4
Revises: 5d9e4c1f2a3b
Create Date: 2026-04-24 14:01:00.000000

If a previous CIC was killed it leaves an INVALID index that still enforces
uniqueness. Re-running fails on the name collision. To recover, run
    DROP INDEX CONCURRENTLY ix_orders_customer_id_receipt_number;
then `alembic upgrade head` again.
"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a9b8c7d6e5f4"
down_revision = "5d9e4c1f2a3b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.create_index(
            "ix_orders_customer_id_receipt_number",
            "orders",
            ["customer_id", "receipt_number"],
            unique=True,
            postgresql_where="receipt_number IS NOT NULL",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.drop_index(
            "ix_orders_customer_id_receipt_number",
            table_name="orders",
            postgresql_concurrently=True,
        )
