"""Update Stripe's product metadata

Revision ID: 40f397ad512a
Revises: 8ca7adb6786e
Create Date: 2024-05-15 12:06:39.431048

"""

import sqlalchemy as sa
from alembic import op

from polar.integrations.stripe.service import stripe as stripe_service

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "40f397ad512a"
down_revision = "8ca7adb6786e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    result = connection.execute(
        sa.text(
            """
            SELECT products.id, products.stripe_product_id
            FROM products
            WHERE stripe_product_id IS NOT NULL;
            """
        )
    )

    for product_id, stripe_product_id in result:
        metadata = {
            "product_id": str(product_id),
            "subscription_tier_id": "",
        }
        stripe_service.update_product(stripe_product_id, metadata=metadata)


def downgrade() -> None:
    connection = op.get_bind()
    result = connection.execute(
        sa.text(
            """
            SELECT products.id, products.stripe_product_id
            FROM products
            WHERE stripe_product_id IS NOT NULL;
            """
        )
    )

    for product_id, stripe_product_id in result:
        metadata = {
            "subscription_tier_id": str(product_id),
            "product_id": "",
        }
        stripe_service.update_product(stripe_product_id, metadata=metadata)
