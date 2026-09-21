"""tune events autovacuum thresholds

Revision ID: 8aa7e7e94a61
Revises: 5d8421240e6c
Create Date: 2026-09-21 09:58:15.239618

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "8aa7e7e94a61"
down_revision = "5d8421240e6c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE events SET (
            autovacuum_vacuum_threshold = 1000,
            autovacuum_vacuum_scale_factor = 0.001,
            autovacuum_vacuum_insert_threshold = 1000,
            autovacuum_vacuum_insert_scale_factor = 0.001,
            autovacuum_analyze_threshold = 1000,
            autovacuum_analyze_scale_factor = 0.005
        )
    """)


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE events RESET (
            autovacuum_vacuum_threshold,
            autovacuum_vacuum_scale_factor,
            autovacuum_vacuum_insert_threshold,
            autovacuum_vacuum_insert_scale_factor,
            autovacuum_analyze_threshold,
            autovacuum_analyze_scale_factor
        )
    """)
