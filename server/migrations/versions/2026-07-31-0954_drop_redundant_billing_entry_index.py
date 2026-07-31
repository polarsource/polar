"""drop redundant billing entry index

Revision ID: 5a1b80eeae48
Revises: 72c8a2d0ea56
Create Date: 2026-07-31 09:54:49.326543

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5a1b80eeae48"
down_revision = "72c8a2d0ea56"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_billing_entries_s_oi_pp"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="billing_entry",
            if_exists=True,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="billing_entry",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX_NAME,
            "billing_entry",
            ["subscription_id", "order_item_id", "product_price_id"],
            unique=False,
            postgresql_concurrently=True,
        )
