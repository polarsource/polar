"""add mcp subscription fields to webhook endpoints

Revision ID: f09f2f11e21c
Revises: eb0688ca4793
Create Date: 2026-11-13 10:50:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f09f2f11e21c"
down_revision = "eb0688ca4793"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_webhook_endpoints_mcp_subscription"


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "webhook_endpoints",
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
        if_not_exists=True,
    )
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_endpoints",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "webhook_endpoints",
                ["organization_id", "url", "events"],
                unique=True,
                postgresql_where=sa.text("format = 'mcp' AND deleted_at IS NULL"),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_endpoints",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("webhook_endpoints", "expires_at")
