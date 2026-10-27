"""add catalog columns to products

Revision ID: 8a4d3f1c7e52
Revises: 6124ede244c2
Create Date: 2026-10-21 09:16:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8a4d3f1c7e52"
down_revision = "6124ede244c2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Run inside an autocommit block so each step commits and releases its lock
    # immediately instead of stacking locks across statements or migrations.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            columns_exist = False
            if not op.get_context().as_sql:
                existing_count = op.get_bind().scalar(
                    sa.text(
                        "SELECT count(*) FROM pg_attribute "
                        "WHERE attrelid = 'products'::regclass "
                        "AND attname IN ('catalog_id', 'is_current') "
                        "AND NOT attisdropped"
                    )
                )
                columns_exist = existing_count == 2

            if not columns_exist:
                op.execute(
                    "ALTER TABLE products "
                    "ADD COLUMN IF NOT EXISTS catalog_id UUID, "
                    "ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true"
                )

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        "WHERE conname = 'products_catalog_id_fkey' "
                        "AND conrelid = 'products'::regclass"
                    )
                )

            if validated is None:
                # ShareRowExclusiveLock only (does not block SELECTs on products).
                op.create_foreign_key(
                    op.f("products_catalog_id_fkey"),
                    "products",
                    "catalogs",
                    ["catalog_id"],
                    ["id"],
                    ondelete="restrict",
                    postgresql_not_valid=True,
                )
            if not validated:
                # ShareUpdateExclusiveLock only (blocks neither reads nor writes).
                op.execute(
                    "ALTER TABLE products VALIDATE CONSTRAINT products_catalog_id_fkey"
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_constraint(
                op.f("products_catalog_id_fkey"),
                "products",
                type_="foreignkey",
                if_exists=True,
            )
            op.execute(
                "ALTER TABLE products "
                "DROP COLUMN IF EXISTS is_current, "
                "DROP COLUMN IF EXISTS catalog_id"
            )
        finally:
            op.execute("RESET lock_timeout")
