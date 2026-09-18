"""tune transaction autovacuum thresholds

Revision ID: 98076b0fbfe3
Revises: f9d1169d7b94
Create Date: 2026-09-18 09:21:07.293826

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "98076b0fbfe3"
down_revision = "f9d1169d7b94"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE transactions SET (
            autovacuum_vacuum_threshold = 1000,
            autovacuum_vacuum_scale_factor = 0.005,
            autovacuum_vacuum_insert_threshold = 1000,
            autovacuum_vacuum_insert_scale_factor = 0.005,
            autovacuum_analyze_threshold = 1000,
            autovacuum_analyze_scale_factor = 0.01
        )
    """)


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute("""
        ALTER TABLE transactions RESET (
            autovacuum_vacuum_threshold,
            autovacuum_vacuum_scale_factor,
            autovacuum_vacuum_insert_threshold,
            autovacuum_vacuum_insert_scale_factor,
            autovacuum_analyze_threshold,
            autovacuum_analyze_scale_factor
        )
    """)
