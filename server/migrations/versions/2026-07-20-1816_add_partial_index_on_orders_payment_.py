"""add partial index on orders payment_lock_acquired_at

Revision ID: 55a5e94aaf9d
Revises: c3553f7b8b0c
Create Date: 2026-07-20 18:16:46.705800

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "55a5e94aaf9d"
down_revision = "c3553f7b8b0c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_orders_payment_lock_acquired_at"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="orders",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "orders",
            ["payment_lock_acquired_at"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text("payment_lock_acquired_at IS NOT NULL"),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="orders",
            if_exists=True,
            postgresql_concurrently=True,
        )
