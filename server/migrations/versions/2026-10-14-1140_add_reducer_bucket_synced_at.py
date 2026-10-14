"""Add reducer bucket synced_at

Revision ID: d8e7663042ca
Revises: 0b6d1f3c9a2e
Create Date: 2026-10-14 11:40:00.317511

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d8e7663042ca"
down_revision = "0b6d1f3c9a2e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Autocommit so the UPDATE doesn't hold the ADD COLUMN's table lock.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.add_column(
                "reducer_buckets",
                sa.Column("synced_at", sa.TIMESTAMP(timezone=True), nullable=True),
            )
            op.execute(
                "UPDATE reducer_buckets SET synced_at = bucket_end "
                "WHERE bucket_end < now() - interval '5 minutes'"
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("reducer_buckets", "synced_at")
