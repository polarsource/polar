"""tune autovacuum for cleanup heavy tables

Revision ID: a95df2da94c0
Revises: f591dcd9ab42
Create Date: 2026-10-12 12:20:17.086901

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a95df2da94c0"
down_revision = "f591dcd9ab42"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

# Cleanup crons archive rows out of partial created_at indexes daily; the default
# scale factor (0.2) leaves weeks of dead index entries for queries to walk through.
AUTOVACUUM_VACUUM_SCALE_FACTORS = {
    "webhook_events": 0.01,
    "webhook_deliveries": 0.01,
    "checkouts": 0.02,
}


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    for table, scale_factor in AUTOVACUUM_VACUUM_SCALE_FACTORS.items():
        op.execute(
            f"ALTER TABLE {table} SET (autovacuum_vacuum_scale_factor = {scale_factor})"
        )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    for table in AUTOVACUUM_VACUUM_SCALE_FACTORS:
        op.execute(f"ALTER TABLE {table} RESET (autovacuum_vacuum_scale_factor)")
