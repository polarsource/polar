"""Test data generators for load tests."""

import random
import string
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from load_tests.common.distribution import PowerLawDistribution
from load_tests.config import config

# Event name distribution: 70% text, 30% image
EVENT_NAMES = ["generate.text", "generate.image"]
EVENT_NAME_WEIGHTS = [0.7, 0.3]

# Meter slug distribution: 60% pack, 40% tier
METER_SLUGS = ["v1:meter:pack", "v1:meter:tier"]
METER_SLUG_WEIGHTS = [0.6, 0.4]


def generate_random_email() -> str:
    """Generate a random test email address."""
    random_str = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"loadtest+{random_str}@polar.sh"


def generate_customer_data() -> dict[str, Any]:
    """
    Generate customer data for checkout using fixed email from config.

    Returns:
        Dictionary with customer details
    """
    return {
        "email": config.customer_email,
        "name": f"Load Test User {uuid4().hex[:8]}",
    }


def generate_checkout_data(
    product_id: str | None = None,
    customer_email: str | None = None,
    seats: int | None = None,
) -> dict[str, Any]:
    """
    Generate checkout creation payload.

    Args:
        product_id: Product ID to create checkout for (uses config default if None)
        customer_email: Customer email (uses config default if None)
        seats: Number of seats for seat-based pricing (optional, only for seat-based products)

    Returns:
        Dictionary with checkout creation data
    """
    product_id = product_id or config.product_id
    if not product_id:
        raise ValueError("Product ID required for checkout creation")

    data = {
        "product_id": product_id,
        "customer_email": customer_email or config.customer_email,
    }

    # Only add seats parameter if explicitly provided (for seat-based pricing products)
    if seats is not None:
        data["seats"] = seats

    return data


def generate_checkout_confirmation_data(
    customer_name: str | None = None,
    customer_email: str | None = None,
    include_billing_address: bool = True,
) -> dict[str, Any]:
    """
    Generate checkout confirmation payload for free products.

    Args:
        customer_name: Customer name (generates random if None)
        customer_email: Customer email (uses config default if None)
        include_billing_address: Whether to include billing address (for paid products)

    Returns:
        Dictionary with checkout confirmation data
    """
    data = {
        "customer_name": customer_name or f"Load Test User {uuid4().hex[:8]}",
        "customer_email": customer_email or config.customer_email,
    }

    # Add billing address for paid products
    # For free products, this is optional but can be included
    if include_billing_address:
        data["customer_billing_address"] = {
            "country": "US",
        }

    return data


def generate_event_payload(
    external_customer_id: str,
    event_name: str | None = None,
    meter_slug: str | None = None,
    total_price: float | None = None,
) -> dict[str, Any]:
    """
    Generate a single event payload for ingestion.

    Args:
        external_customer_id: External customer ID (your system's customer identifier)
        event_name: Event name (random from distribution if None)
        meter_slug: Meter slug for selectedMeterSlug metadata (random if None)
        total_price: Price value for totalPrice metadata (random 0.01-1.00 if None)

    Returns:
        Dictionary with event data matching Mycheli.AI pattern

    Note:
        organization_id is not included in the payload because the load test uses
        organization tokens (polar_oat_*) which infer the organization from the token.
    """
    if event_name is None:
        event_name = random.choices(EVENT_NAMES, weights=EVENT_NAME_WEIGHTS, k=1)[0]

    if meter_slug is None:
        meter_slug = random.choices(METER_SLUGS, weights=METER_SLUG_WEIGHTS, k=1)[0]

    if total_price is None:
        total_price = round(random.uniform(0.01, 1.00), 2)

    return {
        "external_customer_id": external_customer_id,
        "name": event_name,
        "timestamp": datetime.now(UTC).isoformat(),
        "external_id": f"loadtest-{uuid4().hex}",
        "metadata": {
            "selectedMeterSlug": meter_slug,
            "totalPrice": total_price,
        },
    }


def generate_event_batch(
    distribution: PowerLawDistribution,
    batch_size: int | None = None,
) -> list[dict[str, Any]]:
    """
    Generate a batch of events with power-law customer distribution.

    Args:
        distribution: PowerLawDistribution instance for customer selection
        batch_size: Number of events to generate (uses config default if None)

    Returns:
        List of event dictionaries ready for ingestion
    """
    size = batch_size or config.event_batch_size
    external_customer_ids = distribution.select_many(size)

    return [
        generate_event_payload(external_customer_id=ext_cid)
        for ext_cid in external_customer_ids
    ]
