"""add catalog draft revision

Revision ID: 3f7d2c9a41be
Revises: 4a2ac2d3f25b
Create Date: 2026-11-02 16:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3f7d2c9a41be"
down_revision = "4a2ac2d3f25b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_catalogs_organization_id_draft"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # A constant default fills existing rows without rewriting the table.
            op.add_column(
                "catalogs",
                sa.Column("revision", sa.Integer(), server_default="0", nullable=False),
                if_not_exists=True,
            )
            op.add_column(
                "catalogs",
                sa.Column("applied_revision", sa.Integer(), nullable=True),
                if_not_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")

        op.execute("SET lock_timeout = '5min'")
        try:
            # Rebuild an index an interrupted run left invalid.
            valid = op.get_bind().scalar(
                sa.text(
                    "SELECT indisvalid FROM pg_index "
                    "WHERE indexrelid = to_regclass(:name)"
                ),
                {"name": INDEX_NAME},
            )
            if valid is False:
                op.drop_index(
                    INDEX_NAME, table_name="catalogs", postgresql_concurrently=True
                )
            if not valid:
                op.create_index(
                    INDEX_NAME,
                    "catalogs",
                    ["organization_id"],
                    unique=True,
                    postgresql_where=sa.text("status = 'draft' AND deleted_at IS NULL"),
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
                table_name="catalogs",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_column("catalogs", "applied_revision", if_exists=True)
            op.drop_column("catalogs", "revision", if_exists=True)
        finally:
            op.execute("RESET lock_timeout")
