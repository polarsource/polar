"""Add external_id to webhook endpoints

Revision ID: 7df5de861459
Revises: 3c1e9a7b5d2f
Create Date: 2026-10-15 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7df5de861459"
down_revision = "3c1e9a7b5d2f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "webhook_endpoints",
        sa.Column("external_id", sa.String(), nullable=True),
        if_not_exists=True,
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_webhook_endpoints_organization_id_external_id",
                table_name="webhook_endpoints",
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                "ix_webhook_endpoints_organization_id_external_id",
                "webhook_endpoints",
                ["organization_id", "external_id"],
                unique=True,
                postgresql_where=sa.text(
                    "deleted_at IS NULL AND external_id IS NOT NULL"
                ),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_webhook_endpoints_organization_id_external_id",
                table_name="webhook_endpoints",
                postgresql_concurrently=True,
                if_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("webhook_endpoints", "external_id")
