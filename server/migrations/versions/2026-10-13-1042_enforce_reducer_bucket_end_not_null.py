"""Enforce reducer bucket end not null

Revision ID: f7b3f7545a6c
Revises: a95df2da94c0
Create Date: 2026-10-13 10:42:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f7b3f7545a6c"
down_revision = "a95df2da94c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "reducer_buckets_bucket_end_not_null_check"
INTERVAL_CHECK = "reducer_buckets_bucket_end_after_start_check"


def upgrade() -> None:
    # Autocommit so VALIDATE scans without the ADD's lock, and SET NOT NULL
    # reuses the validated check instead of scanning.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                "UPDATE reducer_buckets "
                "SET bucket_end = bucket_start + interval '5 minutes' "
                "WHERE bucket_end IS NULL"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets DROP CONSTRAINT IF EXISTS {NOT_NULL_CHECK}"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets ADD CONSTRAINT {NOT_NULL_CHECK} "
                "CHECK (bucket_end IS NOT NULL) NOT VALID"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets DROP CONSTRAINT IF EXISTS {INTERVAL_CHECK}"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets ADD CONSTRAINT {INTERVAL_CHECK} "
                "CHECK (bucket_end > bucket_start) NOT VALID"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets VALIDATE CONSTRAINT {NOT_NULL_CHECK}"
            )
            op.execute(
                f"ALTER TABLE reducer_buckets VALIDATE CONSTRAINT {INTERVAL_CHECK}"
            )
            op.alter_column(
                "reducer_buckets",
                "bucket_end",
                existing_type=sa.TIMESTAMP(timezone=True),
                nullable=False,
            )
            op.execute(f"ALTER TABLE reducer_buckets DROP CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(f"ALTER TABLE reducer_buckets DROP CONSTRAINT {INTERVAL_CHECK}")
    op.alter_column(
        "reducer_buckets",
        "bucket_end",
        existing_type=sa.TIMESTAMP(timezone=True),
        nullable=True,
    )
