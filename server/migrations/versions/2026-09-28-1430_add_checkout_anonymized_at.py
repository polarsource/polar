"""add checkouts.anonymized_at

Revision ID: 7c3e5f81b204
Revises: 1a1d29060b39
Create Date: 2026-09-28 14:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c3e5f81b204"
down_revision = "1a1d29060b39"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "checkouts",
        sa.Column("anonymized_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("checkouts", "anonymized_at")
