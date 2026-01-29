"""Add member fields to meter_event

Revision ID: a7c2f1b89d34
Revises: e55a3eab311e
Create Date: 2026-01-29 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a7c2f1b89d34"
down_revision = "e55a3eab311e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "meter_events",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "meter_events",
        sa.Column("external_member_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("meter_events", "external_member_id")
    op.drop_column("meter_events", "member_id")
