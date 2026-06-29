"""rebuild benefit_grants scope unique index with manual_grant_id

Appends ``manual_grant_id`` to ``ix_benefit_grants_scope_unique`` so two standalone
manual grants for the same (customer, benefit, member) stay distinct while
subscription/order behavior is preserved (every existing row has
``manual_grant_id IS NULL``, so under ``NULLS NOT DISTINCT`` the collision set is
unchanged).

The index is rebuilt CONCURRENTLY in an autocommit block so the large
``benefit_grants`` table is never locked. A temporary index name is used so a
unique index is enforcing throughout the swap.

Revision ID: f9cfabbc120a
Revises: b15961219bd6
Create Date: 2026-06-24 23:04:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f9cfabbc120a"
down_revision = "b15961219bd6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_benefit_grants_scope_unique"
TMP_INDEX_NAME = "ix_benefit_grants_scope_unique_tmp"
WHERE = sa.text("deleted_at IS NULL")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            TMP_INDEX_NAME,
            "benefit_grants",
            [
                "customer_id",
                "benefit_id",
                "member_id",
                "subscription_id",
                "order_id",
                "manual_grant_id",
            ],
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=WHERE,
            if_not_exists=True,
        )
        op.drop_index(
            INDEX_NAME,
            table_name="benefit_grants",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.execute(f"ALTER INDEX {TMP_INDEX_NAME} RENAME TO {INDEX_NAME}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            TMP_INDEX_NAME,
            "benefit_grants",
            [
                "customer_id",
                "benefit_id",
                "member_id",
                "subscription_id",
                "order_id",
            ],
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=WHERE,
            if_not_exists=True,
        )
        op.drop_index(
            INDEX_NAME,
            table_name="benefit_grants",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.execute(f"ALTER INDEX {TMP_INDEX_NAME} RENAME TO {INDEX_NAME}")
