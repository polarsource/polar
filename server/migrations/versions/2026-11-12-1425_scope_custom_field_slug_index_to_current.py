"""scope custom field slug index to current rows

Revision ID: 4b930dd42c3c
Revises: b38e1fd8a5a5
Create Date: 2026-11-12 14:25:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4b930dd42c3c"
down_revision = "b38e1fd8a5a5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "custom_fields_slug_organization_id_active_key"
CURRENT_INDEX = "custom_fields_slug_organization_id_current_key"
ALL_INDEX = "custom_fields_slug_organization_id_all_key"


def _replace_index(tmp_index: str, stale_index: str, where: str) -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Left over by an interrupted run in the other direction.
            op.drop_index(
                stale_index,
                table_name="custom_fields",
                if_exists=True,
                postgresql_concurrently=True,
            )
            valid = (
                None
                if op.get_context().as_sql
                else op.get_bind().scalar(
                    sa.text(
                        "SELECT indisvalid FROM pg_index "
                        "WHERE indexrelid = to_regclass(:name)"
                    ),
                    {"name": tmp_index},
                )
            )
            # Keep a completed build, and rebuild an interrupted one.
            if valid is False:
                op.drop_index(
                    tmp_index,
                    table_name="custom_fields",
                    postgresql_concurrently=True,
                )
            if not valid:
                op.create_index(
                    tmp_index,
                    "custom_fields",
                    ["slug", "organization_id"],
                    unique=True,
                    postgresql_where=sa.text(where),
                    postgresql_concurrently=True,
                )
            op.drop_index(
                INDEX_NAME,
                table_name="custom_fields",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.execute(f"ALTER INDEX IF EXISTS {tmp_index} RENAME TO {INDEX_NAME}")
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    _replace_index(CURRENT_INDEX, ALL_INDEX, "deleted_at IS NULL AND is_current")


def downgrade() -> None:
    # Only reversible before non-current custom field versions share a slug.
    _replace_index(ALL_INDEX, CURRENT_INDEX, "deleted_at IS NULL")
