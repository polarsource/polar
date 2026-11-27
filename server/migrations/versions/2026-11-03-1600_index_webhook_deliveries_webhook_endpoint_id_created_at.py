"""index webhook_deliveries webhook_endpoint_id created_at

Revision ID: 4e8b2d1f9a63
Revises: c5a1e9d3b7f2
Create Date: 2026-11-03 16:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4e8b2d1f9a63"
down_revision = "c5a1e9d3b7f2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_webhook_deliveries_webhook_endpoint_id_created_at"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_deliveries",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "webhook_deliveries",
                ["webhook_endpoint_id", "created_at"],
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
                table_name="webhook_deliveries",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
