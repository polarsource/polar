"""Add event sequences

Revision ID: da18c34b0e6f
Revises: 847ece08711b
Create Date: 2026-10-07 12:14:58.893961

"""

import sqlalchemy as sa
from alembic import op

revision = "da18c34b0e6f"
down_revision = "847ece08711b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("events", "ingest_sequence")
    op.drop_table("event_sequences")
