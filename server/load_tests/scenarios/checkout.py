"""
Checkout flow load test scenarios.

This module contains Locust user classes for testing the complete
checkout and payment processing flow.
"""

from locust import HttpUser, SequentialTaskSet, between, task

from load_tests.common import (
    generate_checkout_confirmation_data,
    generate_checkout_data,
    generate_customer_data,
    get_auth_headers,
)
from load_tests.config import config


class CheckoutFlowTaskSet(SequentialTaskSet):
    """
    Sequential task set for complete checkout flow.

    Simulates a real user journey:
    1. Create checkout
    2. Update with customer details
    3. Confirm payment (free products) or simulate payment intent
    4. Verify completion
    """

    client_secret: str | None = None
    checkout_id: str | None = None

    @task(4)
    def create_checkout(self):
        """Step 1: Create a new checkout session."""
        try:
            checkout_data = generate_checkout_data()
            with self.client.post(
                "/v1/checkouts/client/",
                json=checkout_data,
                headers=get_auth_headers(),
                catch_response=True,
                name="[Checkout Flow] 1. Create Checkout",
            ) as response:
                if response.status_code == 201:
                    data = response.json()
                    self.client_secret = data.get("client_secret")
                    self.checkout_id = data.get("id")
                    response.success()
                else:
                    response.failure(f"Failed to create checkout: {response.text}")
                    self.interrupt()  # Stop this flow on failure
        except Exception:
            self.interrupt()

    @task(2)
    def update_customer_details(self):
        """Step 2: Update checkout with customer information."""
        if not self.client_secret:
            return

        try:
            customer_data = generate_customer_data()
            with self.client.patch(
                f"/v1/checkouts/client/{self.client_secret}",
                json={"customer": customer_data},
                headers=get_auth_headers(),
                catch_response=True,
                name="[Checkout Flow] 2. Update Customer",
            ) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Failed to update: {response.text}")
        except Exception:
            pass

    @task
    def get_checkout_status(self):
        """Step 3: Retrieve checkout to verify state."""
        if not self.client_secret:
            return

        try:
            with self.client.get(
                f"/v1/checkouts/client/{self.client_secret}",
                headers=get_auth_headers(),
                catch_response=True,
                name="[Checkout Flow] 3. Get Status",
            ) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Failed to get status: {response.status_code}")
        except Exception:
            pass

    @task
    def confirm_checkout(self):
        """
        Step 4: Confirm checkout to complete the order.

        For free products: Creates order via background job.
        For paid products: Would require payment method (confirmation_token_id).
        """
        if not self.client_secret:
            return

        try:
            # Generate confirmation data for free product
            confirmation_data = generate_checkout_confirmation_data(
                include_billing_address=False  # Optional for free products
            )

            with self.client.post(
                f"/v1/checkouts/client/{self.client_secret}/confirm",
                json=confirmation_data,
                headers=get_auth_headers(),
                catch_response=True,
                name="[Checkout Flow] 4. Confirm",
            ) as response:
                if response.status_code in [200, 201]:
                    # Success! Checkout confirmed
                    data = response.json()
                    if data.get("status") == "confirmed":
                        response.success()
                    else:
                        response.failure(
                            f"Checkout status: {data.get('status')} (expected: confirmed)"
                        )
                elif response.status_code == 422:
                    # Validation error - log details
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("detail", response.text)
                        response.failure(f"Validation error: {error_msg}")
                    except Exception:
                        response.failure(f"Validation error: {response.text}")
                else:
                    response.failure(
                        f"Failed to confirm (HTTP {response.status_code}): {response.text}"
                    )
        except Exception:
            pass


class CheckoutUser(HttpUser):
    """
    Standard checkout user with sequential checkout flow.

    Simulates a complete checkout journey from creation to confirmation.
    """

    wait_time = between(1, 5)
    tasks = [CheckoutFlowTaskSet]

    def on_start(self):
        """Initialize user session."""
        if not config.product_id:
            pass
