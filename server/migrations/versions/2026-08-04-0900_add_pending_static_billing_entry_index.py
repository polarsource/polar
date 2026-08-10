"""add partial index for pending static billing entries

Revision ID: c1a7e4b93f2d
Revises: aaa111ca733d
Create Date: 2026-08-04 09:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c1a7e4b93f2d"
down_revision = "aaa111ca733d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_billing_entry_pending_static"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            INDEX_NAME,
            "billing_entry",
            ["subscription_id"],
            unique=False,
            postgresql_where=sa.text(
                "deleted_at IS NULL AND order_item_id IS NULL AND type != 'metered'"
            ),
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
