"""
E2E: Lifecycle — subscription renewal.

An active subscription reaches the end of its billing period.
The cycle task creates billing entries and a new order.

TODO: Implement once the purchase flow helpers are extracted for reuse.
This test requires:
  1. An active subscription (created via purchase flow)
  2. Advancing time or directly calling subscription_service.cycle()
  3. Draining the order.create_subscription_order task
  4. Verification that a new order exists with billing_reason=subscription_cycle
"""

import pytest


@pytest.mark.asyncio
class TestRenewal:
    @pytest.mark.skip(reason="Skeleton — requires subscription setup helpers")
    async def test_subscription_renewal_creates_order(self) -> None:
        pass
