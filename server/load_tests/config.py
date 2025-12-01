"""
Load test configuration.

Environment variables:
- LOAD_TEST_HOST: Base URL of the API (default: http://127.0.0.1:8000)
- LOAD_TEST_API_TOKEN: Personal access token for authenticated requests
- LOAD_TEST_PRODUCT_ID: Product ID for checkout tests
"""

import os
from dataclasses import dataclass


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

    # Performance Thresholds (milliseconds)
    max_checkout_creation_time_ms: int = int(
        os.getenv("LOAD_TEST_CHECKOUT_CREATE_THRESHOLD", "2000")
    )
    max_checkout_confirm_time_ms: int = int(
        os.getenv("LOAD_TEST_CHECKOUT_CONFIRM_THRESHOLD", "3000")
    )
    max_list_endpoint_time_ms: int = int(os.getenv("LOAD_TEST_LIST_THRESHOLD", "1000"))


# Global config instance
config = LoadTestConfig()
