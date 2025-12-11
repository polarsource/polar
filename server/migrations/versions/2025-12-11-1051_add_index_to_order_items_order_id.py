"""add index to order_items.order_id

Revision ID: aa7611c80a41
Revises: cb7c757fe36e
Create Date: 2025-12-11 10:51:08.709436

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "aa7611c80a41"
down_revision = "cb7c757fe36e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_order_items_order_id"),
            "order_items",
            ["order_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_order_items_order_id"), table_name="order_items")
