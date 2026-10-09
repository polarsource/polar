"""Drop event sequences

Revision ID: f9772ac1ba20
Revises: da18c34b0e6f
Create Date: 2026-10-08 16:24:39.249342

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f9772ac1ba20"
down_revision = "da18c34b0e6f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("events", "ingest_sequence")
    op.drop_table("event_sequences")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "event_sequences",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("last_sequence", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("event_sequences_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("organization_id", name=op.f("event_sequences_pkey")),
    )
    op.add_column(
        "events", sa.Column("ingest_sequence", sa.BigInteger(), nullable=True)
    )
