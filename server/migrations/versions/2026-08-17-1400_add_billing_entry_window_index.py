"""add billing_entry window index

Revision ID: 8f31c4d7be05
Revises: 6702e350fa99
Create Date: 2026-08-17 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8f31c4d7be05"
down_revision = "6702e350fa99"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_billing_entry_window"
WHERE = "deleted_at IS NULL"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="billing_entry",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "billing_entry",
            ["subscription_id", "product_price_id", "start_timestamp"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text(WHERE),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="billing_entry",
            if_exists=True,
            postgresql_concurrently=True,
        )
