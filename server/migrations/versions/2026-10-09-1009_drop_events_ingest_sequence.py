"""Drop events ingest_sequence

Revision ID: a940ca6a157a
Revises: 801ce082b125
Create Date: 2026-10-09 10:09:59.352362

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a940ca6a157a"
down_revision = "801ce082b125"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("events", "ingest_sequence")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "events",
        sa.Column("ingest_sequence", sa.BIGINT(), autoincrement=False, nullable=True),
    )
