"""Restore event sequences

Revision ID: 801ce082b125
Revises: f9772ac1ba20
Create Date: 2026-10-09 10:00:36.052734

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "801ce082b125"
down_revision = "f9772ac1ba20"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("event_sequences"):
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
            sa.PrimaryKeyConstraint(
                "organization_id", name=op.f("event_sequences_pkey")
            ),
        )
    if "ingest_sequence" not in {
        column["name"] for column in inspector.get_columns("events")
    }:
        op.add_column(
            "events", sa.Column("ingest_sequence", sa.BigInteger(), nullable=True)
        )


def downgrade() -> None:
    pass
