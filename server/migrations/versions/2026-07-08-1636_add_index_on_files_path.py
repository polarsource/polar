"""add index on files path

Revision ID: 40d0bc3f9994
Revises: f2f377ed2cf5
Create Date: 2026-07-08 16:36:03.674781

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "40d0bc3f9994"
down_revision = "f2f377ed2cf5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_files_path"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="files",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "files",
            ["path"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="files",
            if_exists=True,
            postgresql_concurrently=True,
        )
