"""Add meter_events meter timestamp index

Revision ID: 3c1e9a7b5d2f
Revises: d8e7663042ca
Create Date: 2026-10-14 16:00:00.000000

"""

from alembic import op

revision = "3c1e9a7b5d2f"
down_revision = "d8e7663042ca"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_meter_events_meter_timestamp"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="meter_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "meter_events",
                ["meter_id", "timestamp"],
                unique=False,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="meter_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
