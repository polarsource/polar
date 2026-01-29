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
    # Add columns — ADD COLUMN with nullable=True and no default is non-blocking
    op.add_column(
        "events",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "events",
        sa.Column("external_member_id", sa.String(), nullable=True),
    )

    # Create member_id index concurrently to avoid blocking reads/writes
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_events_member_id"),
            "events",
            ["member_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            op.f("ix_events_member_id"),
            table_name="events",
            postgresql_concurrently=True,
        )

    op.drop_column("events", "external_member_id")
    op.drop_column("events", "member_id")
