"""Target billing interface; the existing reducer service is not wired to it yet."""

from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from polar.models import Customer, Meter
from polar.postgres import AsyncSession

from .types import UsageAggregation, UsageResult, UsageSummary, UsageWindow


class ReducerBillingService(Protocol):
    async def bill(
        self,
        session: AsyncSession,
        customer: Customer,
        windows: Sequence[UsageWindow],
        *,
        claim_windows: Sequence[UsageWindow],
        order_id: UUID,
    ) -> UsageResult:
        """Observe all windows and atomically claim only the validated subset."""
        ...

    async def preview_bill(
        self,
        session: AsyncSession,
        customer: Customer,
        windows: Sequence[UsageWindow],
    ) -> UsageResult:
        """Read pending usage on the primary without sealing or claiming it."""
        ...

    async def split(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        *,
        at: datetime,
    ) -> None:
        """Persist the boundary in the caller's transaction or raise on failure."""
        ...

    async def reset(
        self,
        session: AsyncSession,
        customer: Customer,
        meter: Meter,
        *,
        at: datetime,
    ) -> None:
        """Split synchronously at the reset event time; sealing may remain queued."""
        ...


def merge_summaries(summaries: Sequence[UsageSummary]) -> UsageSummary:
    raise NotImplementedError


def finalize_quantity(summary: UsageSummary, aggregation: UsageAggregation) -> Decimal:
    raise NotImplementedError
