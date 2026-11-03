"""enforce webhook_deliveries organization_id

Revision ID: c830cac0e942
Revises: 2419b9b53df9
Create Date: 2026-11-03 14:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c830cac0e942"
down_revision = "2419b9b53df9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_webhook_deliveries_organization_id_created_at"
CHECK_NAME = "webhook_deliveries_organization_id_not_null"


def upgrade() -> None:
    # Each statement commits on its own, so no lock is held across steps.
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
                ["organization_id", "created_at"],
                unique=False,
                postgresql_concurrently=True,
            )

            op.execute("SET lock_timeout = '5s'")
            # The batched backfill already ran; this finds leftovers through the index.
            op.execute(
                "UPDATE webhook_deliveries SET organization_id = webhook_endpoints.organization_id "
                "FROM webhook_endpoints "
                "WHERE webhook_deliveries.webhook_endpoint_id = webhook_endpoints.id "
                "AND webhook_deliveries.organization_id IS NULL"
            )
            # A validated CHECK lets SET NOT NULL skip its own full scan under
            # ACCESS EXCLUSIVE; VALIDATE scans without blocking reads or writes.
            op.execute(
                f"ALTER TABLE webhook_deliveries DROP CONSTRAINT IF EXISTS {CHECK_NAME}"
            )
            op.execute(
                f"ALTER TABLE webhook_deliveries ADD CONSTRAINT {CHECK_NAME} "
                "CHECK (organization_id IS NOT NULL) NOT VALID"
            )
            op.execute(
                f"ALTER TABLE webhook_deliveries VALIDATE CONSTRAINT {CHECK_NAME}"
            )
            op.execute(
                "ALTER TABLE webhook_deliveries ALTER COLUMN organization_id SET NOT NULL"
            )
            op.execute(f"ALTER TABLE webhook_deliveries DROP CONSTRAINT {CHECK_NAME}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                "ALTER TABLE webhook_deliveries ALTER COLUMN organization_id DROP NOT NULL"
            )
            op.execute("SET lock_timeout = '5min'")
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_deliveries",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
