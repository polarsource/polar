"""scope benefit external_id index to current rows

Revision ID: 4a2ac2d3f25b
Revises: c5f8ae82994c
Create Date: 2026-11-02 12:05:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4a2ac2d3f25b"
down_revision = "c5f8ae82994c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_benefits_organization_id_external_id"
CURRENT_INDEX = f"{INDEX_NAME}_current"
ALL_INDEX = f"{INDEX_NAME}_all"


def _replace_index(tmp_index: str, stale_index: str, where: str) -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Left over by an interrupted run in the other direction.
            op.drop_index(
                stale_index,
                table_name="benefits",
                if_exists=True,
                postgresql_concurrently=True,
            )
            valid = op.get_bind().scalar(
                sa.text(
                    "SELECT indisvalid FROM pg_index "
                    "WHERE indexrelid = to_regclass(:name)"
                ),
                {"name": tmp_index},
            )
            # Keep a completed build, and rebuild an interrupted one.
            if valid is False:
                op.drop_index(
                    tmp_index,
                    table_name="benefits",
                    postgresql_concurrently=True,
                )
            if not valid:
                op.create_index(
                    tmp_index,
                    "benefits",
                    ["organization_id", "external_id"],
                    unique=True,
                    postgresql_where=sa.text(where),
                    postgresql_concurrently=True,
                )
            op.drop_index(
                INDEX_NAME,
                table_name="benefits",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.execute(f"ALTER INDEX IF EXISTS {tmp_index} RENAME TO {INDEX_NAME}")
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    _replace_index(
        CURRENT_INDEX,
        ALL_INDEX,
        "deleted_at IS NULL AND external_id IS NOT NULL AND is_current",
    )


def downgrade() -> None:
    # Only reversible before non-current benefit versions share an external_id.
    _replace_index(
        ALL_INDEX, CURRENT_INDEX, "deleted_at IS NULL AND external_id IS NOT NULL"
    )
