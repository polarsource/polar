"""index subscriptions organization started_at

Revision ID: 7a4c42593e64
Revises: e99cc2a4a4ab
Create Date: 2026-10-04 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7a4c42593e64"
down_revision = "e99cc2a4a4ab"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_subscriptions_organization_id_started_at"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Recover an invalid index left by an interrupted concurrent build.
            op.drop_index(
                INDEX_NAME,
                table_name="subscriptions",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "subscriptions",
                ["organization_id", sa.literal_column("started_at DESC")],
                unique=False,
                postgresql_where=sa.text(
                    "deleted_at IS NULL AND started_at IS NOT NULL"
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
                INDEX_NAME,
                table_name="subscriptions",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
