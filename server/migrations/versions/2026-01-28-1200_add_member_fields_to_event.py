"""Add member fields to event

Revision ID: e55a3eab311e
Revises: b89845322d11
Create Date: 2026-01-28 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e55a3eab311e"
down_revision = "b89845322d11"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add member_id column with FK to members table (SET NULL on delete)
    op.add_column(
        "events",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "events_member_id_fkey",
        "events",
        "members",
        ["member_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_events_member_id"),
        "events",
        ["member_id"],
        unique=False,
    )

    # Add external_member_id column
    op.add_column(
        "events",
        sa.Column("external_member_id", sa.String(), nullable=True),
    )
    op.create_index(
        op.f("ix_events_external_member_id"),
        "events",
        ["external_member_id"],
        unique=False,
    )

    # Composite index on (organization_id, member_id, ingested_at DESC)
    op.create_index(
        "ix_events_organization_member_id_ingested_at_desc",
        "events",
        ["organization_id", "member_id", sa.text("ingested_at DESC")],
        unique=False,
    )

    # Composite index on (organization_id, external_member_id, ingested_at DESC)
    op.create_index(
        "ix_events_organization_external_member_id_ingested_at_desc",
        "events",
        ["organization_id", "external_member_id", sa.text("ingested_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    # Drop composite indexes
    op.drop_index(
        "ix_events_organization_external_member_id_ingested_at_desc",
        table_name="events",
    )
    op.drop_index(
        "ix_events_organization_member_id_ingested_at_desc",
        table_name="events",
    )

    # Drop external_member_id column and its index
    op.drop_index(op.f("ix_events_external_member_id"), table_name="events")
    op.drop_column("events", "external_member_id")

    # Drop member_id column, its FK and index
    op.drop_index(op.f("ix_events_member_id"), table_name="events")
    op.drop_constraint("events_member_id_fkey", "events", type_="foreignkey")
    op.drop_column("events", "member_id")
