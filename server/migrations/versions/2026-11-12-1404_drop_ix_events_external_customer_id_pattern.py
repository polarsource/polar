"""drop ix_events_external_customer_id_pattern

Revision ID: d62a0b8e4c75
Revises: 5c1e8a3f9d27
Create Date: 2026-11-12 14:04:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d62a0b8e4c75"
down_revision = "5c1e8a3f9d27"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_events_external_customer_id_pattern",
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_events_external_customer_id_pattern",
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                "ix_events_external_customer_id_pattern",
                "events",
                ["external_customer_id"],
                postgresql_ops={"external_customer_id": "text_pattern_ops"},
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
