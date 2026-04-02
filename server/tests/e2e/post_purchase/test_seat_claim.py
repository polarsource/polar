"""
E2E: Post-purchase — seat claiming.

After a seat-based order is created, the buyer assigns seats via invitation.
Recipients claim their seat with a token, which triggers benefit grants.

TODO: Implement once the purchase flow helpers are extracted for reuse.
This test requires:
  1. A completed seat-based purchase (order with seats)
  2. Seat assignment via API (POST /v1/customer-seats/)
  3. Seat claim via token (POST /v1/customer-sessions/claim_seat)
  4. Verification that benefits were granted to the seat holder
"""

import pytest


@pytest.mark.asyncio
class TestSeatClaim:
    @pytest.mark.skip(reason="Skeleton — requires purchase flow helpers")
    async def test_assign_and_claim_seat(self) -> None:
        pass
