"""Add indexes on event_id FK columns for faster cascade deletes

Revision ID: 7a8b9c0d1e2f
Revises: 81cb97134c21
Create Date: 2026-01-20

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7a8b9c0d1e2f"
down_revision = "81cb97134c21"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_billing_entry_event_id",
            "billing_entry",
            ["event_id"],
            if_not_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            "ix_meter_events_event_id",
            "meter_events",
            ["event_id"],
            if_not_exists=True,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_meter_events_event_id",
            table_name="meter_events",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.drop_index(
            "ix_billing_entry_event_id",
            table_name="billing_entry",
            if_exists=True,
            postgresql_concurrently=True,
        )
