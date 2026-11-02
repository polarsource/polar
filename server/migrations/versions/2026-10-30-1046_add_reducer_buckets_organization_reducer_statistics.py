"""add reducer_buckets organization/reducer statistics

Revision ID: 929b2b9495f2
Revises: 63f5f40b47d9
Create Date: 2026-10-30 10:46:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "929b2b9495f2"
down_revision = "63f5f40b47d9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "CREATE STATISTICS reducer_buckets_organization_reducer (dependencies) "
        "ON organization_id, reducer_id FROM reducer_buckets"
    )
    op.execute("ANALYZE reducer_buckets")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("DROP STATISTICS IF EXISTS reducer_buckets_organization_reducer")
