"""add staged_events

Revision ID: 9d3b7e1f4a62
Revises: 7c1e4a9b2d3f
Create Date: 2026-10-19 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9d3b7e1f4a62"
down_revision = "7c1e4a9b2d3f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "staged_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("ingested_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("timestamp", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("external_customer_id", sa.String(), nullable=True),
        sa.Column("member_id", sa.Uuid(), nullable=True),
        sa.Column("external_member_id", sa.String(), nullable=True),
        sa.Column("external_id", sa.String(), nullable=True),
        sa.Column("pending_parent_external_id", sa.String(), nullable=True),
        sa.Column("event_type_id", sa.Uuid(), nullable=True),
        sa.Column(
            "user_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("staged_events_pkey")),
        postgresql_with={
            "autovacuum_vacuum_scale_factor": 0,
            "autovacuum_vacuum_threshold": 10000,
            "autovacuum_vacuum_cost_delay": 0,
        },
    )
    op.create_index(
        "ix_staged_events_organization_id_external_id",
        "staged_events",
        ["organization_id", "external_id"],
        unique=True,
        postgresql_where="external_id IS NOT NULL",
    )
    op.create_index(
        "ix_staged_events_organization_id_timestamp",
        "staged_events",
        ["organization_id", "timestamp"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("staged_events")
