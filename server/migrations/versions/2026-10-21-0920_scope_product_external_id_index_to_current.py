"""scope product external_id index to current rows

Revision ID: 4f8a2c6e1b90
Revises: 8a4d3f1c7e52
Create Date: 2026-10-21 09:20:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4f8a2c6e1b90"
down_revision = "8a4d3f1c7e52"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_products_organization_id_external_id"
NEW_INDEX_NAME = "ix_products_organization_id_external_id_current"


def _swap(where: str, *, scoped_to_current: bool) -> None:
    with op.get_context().autocommit_block():
        if not op.get_context().as_sql:
            current_def = op.get_bind().scalar(
                sa.text(
                    "SELECT pg_get_indexdef(i.indexrelid) "
                    "FROM pg_index i "
                    "WHERE i.indexrelid = to_regclass(:name) AND i.indisvalid"
                ),
                {"name": INDEX_NAME},
            )
            if current_def is not None and (
                ("is_current" in current_def) == scoped_to_current
            ):
                return

        op.execute("SET lock_timeout = '5min'")
        try:
            valid: bool | None = None
            if not op.get_context().as_sql:
                valid = op.get_bind().scalar(
                    sa.text(
                        "SELECT indisvalid FROM pg_index "
                        "WHERE indexrelid = to_regclass(:name)"
                    ),
                    {"name": NEW_INDEX_NAME},
                )
            # Preserve completed replacements and recover interrupted builds.
            if valid is False or op.get_context().as_sql:
                op.drop_index(
                    NEW_INDEX_NAME,
                    table_name="products",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
            if not valid:
                op.create_index(
                    NEW_INDEX_NAME,
                    "products",
                    ["organization_id", "external_id"],
                    unique=True,
                    postgresql_where=sa.text(where),
                    postgresql_concurrently=True,
                )
            op.drop_index(
                INDEX_NAME,
                table_name="products",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.execute("SET lock_timeout = '5s'")
            op.execute(f"ALTER INDEX IF EXISTS {NEW_INDEX_NAME} RENAME TO {INDEX_NAME}")
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    _swap(
        "deleted_at IS NULL AND external_id IS NOT NULL AND is_current",
        scoped_to_current=True,
    )


def downgrade() -> None:
    # Only reversible before non-current product versions share an external_id.
    _swap(
        "deleted_at IS NULL AND external_id IS NOT NULL",
        scoped_to_current=False,
    )
