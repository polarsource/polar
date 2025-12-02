"""
Load test configuration.

Environment variables:
- LOAD_TEST_HOST: Base URL of the API (default: http://127.0.0.1:8000)
- LOAD_TEST_API_TOKEN: Organization access token (polar_oat_*) for authenticated requests
- LOAD_TEST_PRODUCT_ID: Product ID for checkout tests
- LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS: Comma-separated list of external customer IDs
- LOAD_TEST_EVENT_BATCH_SIZE: Number of events per batch (default: 10)
"""

import os
from dataclasses import dataclass, field


def _parse_external_customer_ids() -> list[str]:
    """Parse comma-separated external customer IDs from environment."""
    raw = os.getenv("LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS", "")
    if not raw:
        return []
    return [cid.strip() for cid in raw.split(",") if cid.strip()]


@dataclass
class LoadTestConfig:
    """Configuration for load tests."""

    # API Configuration
    host: str = os.getenv("LOAD_TEST_HOST", "http://127.0.0.1:8000")
    api_token: str | None = os.getenv("LOAD_TEST_API_TOKEN")
    product_id: str | None = os.getenv("LOAD_TEST_PRODUCT_ID")
    customer_email: str = os.getenv(
        "LOAD_TEST_CUSTOMER_EMAIL", "petru+loadtest@polar.sh"
    )

    # Event Ingestion Configuration
    # Based on Mycheli.AI: 18k events/hour with 2.7k requests/hour = ~7 events/request
    event_external_customer_ids: list[str] = field(
        default_factory=_parse_external_customer_ids
    )
    event_batch_size: int = int(os.getenv("LOAD_TEST_EVENT_BATCH_SIZE", "7"))

    # Performance Thresholds (milliseconds)
    max_checkout_creation_time_ms: int = int(
        os.getenv("LOAD_TEST_CHECKOUT_CREATE_THRESHOLD", "2000")
    )
    max_checkout_confirm_time_ms: int = int(
        os.getenv("LOAD_TEST_CHECKOUT_CONFIRM_THRESHOLD", "3000")
    )
    max_list_endpoint_time_ms: int = int(os.getenv("LOAD_TEST_LIST_THRESHOLD", "1000"))
    max_event_ingest_time_ms: int = int(
        os.getenv("LOAD_TEST_EVENT_INGEST_THRESHOLD", "1000")
    )


# Global config instance
config = LoadTestConfig()
