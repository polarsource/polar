"""add completed webhook endpoint index

Revision ID: 0ca20ea806d4
Revises: 38a9961f9d09
Create Date: 2026-09-16 16:43:17.380220

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "0ca20ea806d4"
down_revision = "38a9961f9d09"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEX_NAME = "ix_webhook_events_endpoint_completed"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "webhook_events",
                ["webhook_endpoint_id", sa.literal_column("created_at DESC")],
                postgresql_include=["succeeded"],
                postgresql_where="succeeded IS NOT NULL AND deleted_at IS NULL",
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
