"""
Main Locust load test file for Polar API.

This file imports load test scenarios for testing the Polar payment infrastructure.

Usage:
    # Interactive mode with web UI
    uv run task loadtest

    # Headless mode (CI/automated testing)
    uv run task loadtest_headless

    # Run specific scenario (event ingestion)
    locust -f load_tests/locustfile.py --host=http://127.0.0.1:8000 \
           --users 5 --spawn-rate 1 --run-time 5m EventIngestionUser

    # Run checkout scenario
    locust -f load_tests/locustfile.py --host=http://127.0.0.1:8000 \
           --users 10 --spawn-rate 2 --run-time 5m CheckoutUser

Environment variables:
    See load_tests/config.py for configuration options
"""

from load_tests.scenarios import CheckoutUser, EventIngestionUser

__all__ = ["CheckoutUser", "EventIngestionUser"]
