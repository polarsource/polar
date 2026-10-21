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
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "products",
        sa.Column("catalog_id", sa.Uuid(), nullable=True),
        if_not_exists=True,
    )
    op.add_column(
        "products",
        sa.Column(
            "is_current", sa.Boolean(), server_default=sa.text("true"), nullable=True
        ),
        if_not_exists=True,
    )
    op.drop_constraint(
        op.f("products_catalog_id_fkey"),
        "products",
        type_="foreignkey",
        if_exists=True,
    )
    op.create_foreign_key(
        op.f("products_catalog_id_fkey"),
        "products",
        "catalogs",
        ["catalog_id"],
        ["id"],
        ondelete="restrict",
        postgresql_not_valid=True,
    )
    # Validate outside the transaction, so the scan doesn't hold the lock taken
    # by adding the constraint.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.execute(
                "ALTER TABLE products VALIDATE CONSTRAINT products_catalog_id_fkey"
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("products_catalog_id_fkey"), "products", type_="foreignkey", if_exists=True
    )
    op.drop_column("products", "is_current", if_exists=True)
    op.drop_column("products", "catalog_id", if_exists=True)
