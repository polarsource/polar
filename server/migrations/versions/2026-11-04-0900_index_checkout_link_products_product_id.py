"""index checkout_link_products product_id

Revision ID: 7c1e4b9a2d63
Revises: 9d2e3f5a7b8c
Create Date: 2026-11-04 09:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c1e4b9a2d63"
down_revision = "9d2e3f5a7b8c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_checkout_link_products_product_id"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX,
                table_name="checkout_link_products",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX,
                "checkout_link_products",
                ["product_id"],
                unique=False,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX,
                table_name="checkout_link_products",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
