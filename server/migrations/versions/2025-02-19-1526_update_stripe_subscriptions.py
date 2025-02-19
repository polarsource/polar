"""Update Stripe Subscriptions

Revision ID: 21585ed16305
Revises: 69d1834e6285
Create Date: 2025-02-19 15:26:53.346054

"""

import concurrent.futures
import random
import time
import uuid
from typing import Any

import sqlalchemy as sa
import stripe as stripe_lib
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "21585ed16305"
down_revision = "69d1834e6285"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def process_subscription(
    subscription: tuple[str, uuid.UUID, uuid.UUID], retry: int = 1
) -> None:
    stripe_id, product_id, price_id = subscription
    metadata = {
        "type": "product",
        "product_id": str(product_id),
        "product_price_id": str(price_id),
    }
    try:
        stripe_lib.Subscription.modify(
            stripe_id,
            metadata=metadata,
        )
    except stripe_lib.RateLimitError:
        time.sleep(retry + random.random())
        return process_subscription(subscription, retry=retry + 1)


def process_subscriptions(results: sa.CursorResult[Any]) -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        for result in results:
            executor.submit(process_subscription, result._tuple())


def upgrade() -> None:
    connection = op.get_bind()
    results = connection.execute(
        sa.text("""
            SELECT stripe_subscription_id, product_id, price_id
            FROM subscriptions
            WHERE stripe_subscription_id IS NOT NULL
        """)
    )
    process_subscriptions(results)


def downgrade() -> None:
    pass
