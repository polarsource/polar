"""add product_id indexes for product deletion check

Revision ID: a1a254db0992
Revises: 3174cde85cb5
Create Date: 2026-09-23 08:56:13.464937

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1a254db0992"
down_revision = "3174cde85cb5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


INDEXES = (
    ("ix_discount_products_product_id", "discount_products"),
    ("ix_subscription_updates_product_id", "subscription_updates"),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for index_name, table_name in INDEXES:
                op.drop_index(
                    index_name,
                    table_name=table_name,
                    postgresql_concurrently=True,
                    if_exists=True,
                )
                op.create_index(
                    index_name,
                    table_name,
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
            for index_name, table_name in INDEXES:
                op.drop_index(
                    index_name,
                    table_name=table_name,
                    postgresql_concurrently=True,
                    if_exists=True,
                )
        finally:
            op.execute("RESET lock_timeout")
