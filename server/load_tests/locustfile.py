"""
Main Locust load test file for Polar API.

This file imports the checkout scenario for testing the Polar payment infrastructure.

Usage:
    # Interactive mode with web UI
    uv run task loadtest

    # Headless mode (CI/automated testing)
    uv run task loadtest_headless

    # Custom parameters
    locust -f load_tests/locustfile.py --host=http://127.0.0.1:8000 \
           --users 10 --spawn-rate 2 --run-time 5m

Environment variables:
    See load_tests/config.py for configuration options
"""

from load_tests.scenarios import CheckoutUser

__all__ = ["CheckoutUser"]
