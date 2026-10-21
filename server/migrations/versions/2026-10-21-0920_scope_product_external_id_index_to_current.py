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

OLD_INDEX = "ix_products_organization_id_external_id"
NEW_INDEX = "ix_products_organization_id_external_id_current"


def _replace_index(new_name: str, old_name: str, where: str) -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            valid = op.get_bind().scalar(
                sa.text(
                    "SELECT indisvalid FROM pg_index "
                    "WHERE indexrelid = to_regclass(:name)"
                ),
                {"name": new_name},
            )
            # Preserve completed replacements and recover interrupted builds.
            if valid is False:
                op.drop_index(
                    new_name,
                    table_name="products",
                    postgresql_concurrently=True,
                )
            if not valid:
                op.create_index(
                    new_name,
                    "products",
                    ["organization_id", "external_id"],
                    unique=True,
                    postgresql_where=sa.text(where),
                    postgresql_concurrently=True,
                )
            op.drop_index(
                old_name,
                table_name="products",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def upgrade() -> None:
    _replace_index(
        NEW_INDEX,
        OLD_INDEX,
        "deleted_at IS NULL AND external_id IS NOT NULL AND is_current",
    )


def downgrade() -> None:
    # Only reversible before non-current product versions share an external_id.
    _replace_index(
        OLD_INDEX,
        NEW_INDEX,
        "deleted_at IS NULL AND external_id IS NOT NULL",
    )
