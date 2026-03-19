"""add pending_parent_external_id to events

Revision ID: f96e4424ec70
Revises: 9e14393a579f
Create Date: 2026-03-19 15:21:24.903188

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f96e4424ec70"
down_revision = "9e14393a579f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("pending_parent_external_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_events_org_pending_parent",
        "events",
        ["organization_id", "pending_parent_external_id"],
        unique=False,
        postgresql_where=sa.text("pending_parent_external_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_events_org_pending_parent",
        table_name="events",
    )
    op.drop_column("events", "pending_parent_external_id")
