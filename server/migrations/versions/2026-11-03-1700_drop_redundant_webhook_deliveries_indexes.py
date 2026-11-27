"""drop redundant webhook_deliveries indexes

Revision ID: 9d3f6a2c7b18
Revises: 4e8b2d1f9a63
Create Date: 2026-11-03 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9d3f6a2c7b18"
down_revision = "4e8b2d1f9a63"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

WEBHOOK_ENDPOINT_ID_INDEX = "ix_webhook_deliveries_webhook_endpoint_id"
CREATED_AT_WITH_RESPONSE_INDEX = "ix_webhook_deliveries_created_at_with_response"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for index_name in (
                WEBHOOK_ENDPOINT_ID_INDEX,
                CREATED_AT_WITH_RESPONSE_INDEX,
            ):
                op.drop_index(
                    index_name,
                    table_name="webhook_deliveries",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for index_name in (
                WEBHOOK_ENDPOINT_ID_INDEX,
                CREATED_AT_WITH_RESPONSE_INDEX,
            ):
                op.drop_index(
                    index_name,
                    table_name="webhook_deliveries",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
            op.create_index(
                WEBHOOK_ENDPOINT_ID_INDEX,
                "webhook_deliveries",
                ["webhook_endpoint_id"],
                unique=False,
                postgresql_concurrently=True,
            )
            op.create_index(
                CREATED_AT_WITH_RESPONSE_INDEX,
                "webhook_deliveries",
                ["created_at", "id"],
                unique=False,
                postgresql_where=sa.text("response IS NOT NULL"),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
