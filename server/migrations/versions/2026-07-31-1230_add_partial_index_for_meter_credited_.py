"""add partial index for meter.credited events

Revision ID: c9a17e3f4b52
Revises: 5a1b80eeae48
Create Date: 2026-07-31 12:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c9a17e3f4b52"
down_revision = "5a1b80eeae48"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_events_meter_credited"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # A failed/canceled concurrent build leaves an INVALID index behind;
        # drop it first so rerunning this (unrecorded) migration recovers.
        op.drop_index(
            INDEX_NAME,
            table_name="events",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX_NAME,
            "events",
            ["organization_id", "ingested_at"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text("source = 'system' AND name = 'meter.credited'"),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="events",
            if_exists=True,
            postgresql_concurrently=True,
        )
