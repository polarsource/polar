"""add unique scope index on benefit_grants

Revision ID: 01cce9b1fcc2
Revises: e5522ef4ec57
Create Date: 2026-06-16 10:22:05.261607

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "01cce9b1fcc2"
down_revision = "9cc1600f3dab"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Build concurrently to avoid blocking writes on the large benefit_grants
    # table. CREATE INDEX CONCURRENTLY cannot run inside a transaction, so we
    # use an autocommit block (which also means no transactional lock_timeout).
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_benefit_grants_scope_unique",
            "benefit_grants",
            ["customer_id", "benefit_id", "member_id", "subscription_id", "order_id"],
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_benefit_grants_scope_unique",
            table_name="benefit_grants",
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
