"""tune autovacuum for cleanup heavy tables

Revision ID: a95df2da94c0
Revises: f591dcd9ab42
Create Date: 2026-10-12 12:20:17.086901

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a95df2da94c0"
down_revision = "f591dcd9ab42"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE webhook_events SET (
            autovacuum_vacuum_threshold = 1000,
            autovacuum_vacuum_scale_factor = 0.01,
            autovacuum_vacuum_insert_threshold = 1000,
            autovacuum_vacuum_insert_scale_factor = 0.01,
            autovacuum_analyze_threshold = 1000,
            autovacuum_analyze_scale_factor = 0.02
        )
    """)
    op.execute("""
        ALTER TABLE webhook_deliveries SET (
            autovacuum_vacuum_threshold = 1000,
            autovacuum_vacuum_scale_factor = 0.01,
            autovacuum_vacuum_insert_threshold = 1000,
            autovacuum_vacuum_insert_scale_factor = 0.01,
            autovacuum_analyze_threshold = 1000,
            autovacuum_analyze_scale_factor = 0.02
        )
    """)
    op.execute("""
        ALTER TABLE checkouts SET (
            autovacuum_vacuum_threshold = 1000,
            autovacuum_vacuum_scale_factor = 0.02,
            autovacuum_vacuum_insert_threshold = 1000,
            autovacuum_vacuum_insert_scale_factor = 0.02,
            autovacuum_analyze_threshold = 1000,
            autovacuum_analyze_scale_factor = 0.04
        )
    """)


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE webhook_events RESET (
            autovacuum_vacuum_threshold,
            autovacuum_vacuum_scale_factor,
            autovacuum_vacuum_insert_threshold,
            autovacuum_vacuum_insert_scale_factor,
            autovacuum_analyze_threshold,
            autovacuum_analyze_scale_factor
        )
    """)
    op.execute("""
        ALTER TABLE webhook_deliveries RESET (
            autovacuum_vacuum_threshold,
            autovacuum_vacuum_scale_factor,
            autovacuum_vacuum_insert_threshold,
            autovacuum_vacuum_insert_scale_factor,
            autovacuum_analyze_threshold,
            autovacuum_analyze_scale_factor
        )
    """)
    op.execute("""
        ALTER TABLE checkouts RESET (
            autovacuum_vacuum_threshold,
            autovacuum_vacuum_scale_factor,
            autovacuum_vacuum_insert_threshold,
            autovacuum_vacuum_insert_scale_factor,
            autovacuum_analyze_threshold,
            autovacuum_analyze_scale_factor
        )
    """)
