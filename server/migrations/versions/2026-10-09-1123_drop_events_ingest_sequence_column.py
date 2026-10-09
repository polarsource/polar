"""Drop events ingest_sequence column

Revision ID: 4925930eb877
Revises: a940ca6a157a
Create Date: 2026-10-09 11:23:00.928222

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4925930eb877"
down_revision = "a940ca6a157a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    columns = sa.inspect(op.get_bind()).get_columns("events")
    if "ingest_sequence" in {column["name"] for column in columns}:
        op.drop_column("events", "ingest_sequence")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "events", sa.Column("ingest_sequence", sa.BigInteger(), nullable=True)
    )
