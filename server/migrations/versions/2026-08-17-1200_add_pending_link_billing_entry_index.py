"""add partial index for linking pending billing entries

Revision ID: f3d81c25ab90
Revises: d54b19ea954c
Create Date: 2026-08-17 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3d81c25ab90"
down_revision = "d54b19ea954c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_billing_entry_pending_link"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX_NAME,
            table_name="billing_entry",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.create_index(
            INDEX_NAME,
            "billing_entry",
            ["subscription_id", "product_price_id", "id"],
            unique=False,
            postgresql_where=sa.text("deleted_at IS NULL AND order_item_id IS NULL"),
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="billing_entry",
            postgresql_concurrently=True,
            if_exists=True,
        )
