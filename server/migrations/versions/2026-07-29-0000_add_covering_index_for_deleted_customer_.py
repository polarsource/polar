"""add covering index for deleted customer invariant check

Revision ID: 8f3d1c4a9e21
Revises: 45773b693045
Create Date: 2026-07-29 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8f3d1c4a9e21"
down_revision = "45773b693045"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_customers_deleted_at_id"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # A failed/canceled concurrent build leaves an INVALID index behind;
        # drop it first so rerunning this (unrecorded) migration recovers.
        op.drop_index(
            INDEX_NAME,
            table_name="customers",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX_NAME,
            "customers",
            ["deleted_at", "id"],
            unique=False,
            postgresql_concurrently=True,
            postgresql_where=sa.text("deleted_at IS NOT NULL"),
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="customers",
            if_exists=True,
            postgresql_concurrently=True,
        )
