"""add partial index on organizations status for backoffice list

Revision ID: b58196b41f41
Revises: a83cf131398d
Create Date: 2026-08-28 14:35:09.753552

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b58196b41f41"
down_revision = "a83cf131398d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_organizations_status_priority"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX_NAME,
            table_name="organizations",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.create_index(
            INDEX_NAME,
            "organizations",
            [sa.text("status DESC"), sa.text("status_updated_at ASC NULLS FIRST")],
            unique=False,
            postgresql_where=sa.text("deleted_at IS NULL"),
            postgresql_concurrently=True,
            if_not_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="organizations",
            postgresql_concurrently=True,
            if_exists=True,
        )
