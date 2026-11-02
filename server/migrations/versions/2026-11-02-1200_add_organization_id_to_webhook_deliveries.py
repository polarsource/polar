"""add organization_id to webhook_deliveries

Revision ID: 8d68bc269a28
Revises: b679b748f61d
Create Date: 2026-11-02 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8d68bc269a28"
down_revision = "b679b748f61d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

FOREIGN_KEY_NAME = "webhook_deliveries_organization_id_fkey"
INDEX_NAME = "ix_webhook_deliveries_organization_id_created_at"


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "webhook_deliveries",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
    )
    # Validated after the backfill, so adding it doesn't scan the table under lock.
    op.create_foreign_key(
        op.f(FOREIGN_KEY_NAME),
        "webhook_deliveries",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
        postgresql_not_valid=True,
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Recover an invalid index left by an interrupted concurrent build.
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

    op.drop_constraint(op.f(FOREIGN_KEY_NAME), "webhook_deliveries", type_="foreignkey")
    op.drop_column("webhook_deliveries", "organization_id")
