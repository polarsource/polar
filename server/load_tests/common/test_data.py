"""Test data generators for load tests."""

import random
import string
from typing import Any
from uuid import uuid4

from load_tests.config import config


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
