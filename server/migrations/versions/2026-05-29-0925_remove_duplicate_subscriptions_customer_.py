"""remove duplicate subscriptions customer_id index

Revision ID: 5579239c38c0
Revises: f1a3c7429eba
Create Date: 2026-05-29 09:25:24.012577

Drops the single-column ix_subscriptions_customer_id index, now superseded by
the composite ix_subscriptions_customer_id_status index added in the previous
migration (a btree on (customer_id, status) also serves customer_id-only
lookups).

If a previous CIC was killed it leaves an INVALID index behind. Re-running the
downgrade fails on the name collision. To recover, run
    DROP INDEX CONCURRENTLY ix_subscriptions_customer_id;
then `alembic downgrade` again.

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5579239c38c0"
down_revision = "f1a3c7429eba"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.drop_index(
            op.f("ix_subscriptions_customer_id"),
            table_name="subscriptions",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.create_index(
            op.f("ix_subscriptions_customer_id"),
            "subscriptions",
            ["customer_id"],
            postgresql_concurrently=True,
        )
