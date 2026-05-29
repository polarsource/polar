"""add (customer_id, status) index on subscriptions

Revision ID: f1a3c7429eba
Revises: 0c12d2aaab31
Create Date: 2026-05-29 09:18:38.849185

Adds the composite index alongside the existing single-column
ix_subscriptions_customer_id index. The old index is dropped in a follow-up
migration once this one is deployed.

If a previous CIC was killed it leaves an INVALID index behind. Re-running
fails on the name collision. To recover, run
    DROP INDEX CONCURRENTLY ix_subscriptions_customer_id_status;
then `alembic upgrade head` again.

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f1a3c7429eba"
down_revision = "0c12d2aaab31"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.create_index(
            "ix_subscriptions_customer_id_status",
            "subscriptions",
            ["customer_id", "status"],
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.drop_index(
            "ix_subscriptions_customer_id_status",
            table_name="subscriptions",
            postgresql_concurrently=True,
        )
