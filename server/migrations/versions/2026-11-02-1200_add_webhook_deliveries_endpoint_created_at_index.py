"""Add webhook_deliveries (webhook_endpoint_id, created_at) index

Revision ID: 3e9b1c7d4a2f
Revises: b679b748f61d
Create Date: 2026-11-02 12:00:00.000000

"""

from alembic import op

revision = "3e9b1c7d4a2f"
down_revision = "b679b748f61d"
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
