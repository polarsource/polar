"""Drop external_id from webhook endpoints

Revision ID: af583efb3558
Revises: dfe1a3d3e11f
Create Date: 2026-11-26 14:04:54.189513

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "af583efb3558"
down_revision = "dfe1a3d3e11f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEX_NAME = "ix_webhook_endpoints_organization_id_external_id"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_endpoints",
                postgresql_concurrently=True,
                if_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("webhook_endpoints", "external_id")


def downgrade() -> None:
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
                INDEX_NAME,
                table_name="webhook_endpoints",
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                INDEX_NAME,
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
