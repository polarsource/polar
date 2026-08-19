import dataclasses
from collections.abc import Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Select

from polar.event.repository import EventRepository
from polar.event.system import SystemEvent
from polar.kit.math import non_negative_running_sum
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction
from polar.meter.service import meter as meter_service
from polar.models import Event, MeterPeriod, Subscription
from polar.models.event import EventSource
from polar.models.meter_period import MeterPeriodStatus
from polar.postgres import AsyncSession
from polar.product.guard import is_metered_price

from .repository import MeterPeriodRepository


@dataclasses.dataclass
class MeterPeriodSettlement:
    """
    The outcome of settling a period.

    ``amount`` is the total owed for the period so far; ``charge`` is what a new
    invoice should bill, i.e. the increase over what has already been billed. On a
    first settlement the two are equal.
    """

    period: MeterPeriod
    quantity: Decimal
    credited_units: Decimal
    amount: int
    charge: int
    label: str


class MeterPeriodService:
    async def open_for_subscription(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        starts_at: datetime,
        ends_at: datetime,
    ) -> Sequence[MeterPeriod]:
        """
        Open one period per metered price on the subscription.

        Idempotent: a price that already has an accruing period is left alone, so
        this is safe to call on every cycle.
        """
        repository = MeterPeriodRepository.from_session(session)
        billable = subscription.trial_end is None or starts_at >= subscription.trial_end

        periods: list[MeterPeriod] = []
        for subscription_price in subscription.subscription_product_prices:
            price = subscription_price.product_price
            if not is_metered_price(price):
                continue

            existing = await repository.get_accruing_by_subscription_and_meter(
                subscription.id, price.meter_id, options=repository.get_eager_options()
            )
            if existing is not None:
                periods.append(existing)
                continue

            periods.append(
                await repository.create(
                    MeterPeriod(
                        starts_at=starts_at,
                        ends_at=ends_at,
                        status=MeterPeriodStatus.accruing,
                        billable=billable,
                        currency=price.price_currency,
                        subscription=subscription,
                        meter=price.meter,
                        product_price=price,
                    ),
                    flush=True,
                )
            )

        return periods

    async def get_quantity(
        self,
        session: AsyncSession,
        period: MeterPeriod,
        *,
        cutoff: datetime | None = None,
    ) -> Decimal:
        """Aggregate the meter over the billing entries in
        ``[starts_at, min(ends_at, cutoff))``."""
        meter = period.meter
        event_repository = EventRepository.from_session(session)
        window_end = self._window_end(period, cutoff)

        if meter.aggregation.func == AggregationFunction.cnt:
            # One entry per event, so the entries are the quantity. Reaching through
            # to `events` for a count fans the scan out into a per-event lookup that
            # times out on high-volume subscriptions.
            total = await event_repository.count_entries_in_window(
                period.subscription_id,
                period.meter_id,
                starts_at=period.starts_at,
                ends_at=window_end,
            )
            system = await event_repository.count_system_entries_in_window(
                period.subscription_id,
                period.meter_id,
                organization_id=meter.organization_id,
                customer_id=period.subscription.customer_id,
                starts_at=period.starts_at,
                ends_at=window_end,
            )
            return Decimal(total - system)

        statement = self._events_statement(event_repository, period, cutoff).where(
            Event.organization_id == meter.organization_id,
            Event.source == EventSource.user,
        )
        quantity = await meter_service.get_quantity(session, meter, statement)
        return Decimal(str(quantity))

    async def get_credited_units(
        self,
        session: AsyncSession,
        period: MeterPeriod,
        *,
        cutoff: datetime | None = None,
    ) -> Decimal:
        """Allowance granted inside the window, from its ``meter.credited`` events."""
        meter = period.meter
        event_repository = EventRepository.from_session(session)
        statement = (
            self._events_statement(event_repository, period, cutoff)
            .where(
                Event.organization_id == meter.organization_id,
                Event.customer_id == period.subscription.customer_id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_credited,
            )
            .order_by(None)
            .order_by(Event.timestamp.asc())
        )
        credit_events = await event_repository.get_all(statement)
        return Decimal(
            non_negative_running_sum(
                event.user_metadata["units"] for event in credit_events
            )
        )

    async def compute_settlement(
        self,
        session: AsyncSession,
        period: MeterPeriod,
        *,
        cutoff: datetime | None = None,
    ) -> MeterPeriodSettlement:
        """
        What the period owes, without persisting anything.

        Read-only, so it is safe on preview paths (charge previews, subscription meter
        refreshes) that must not advance a period's billing state.
        """
        price = period.product_price

        quantity = await self.get_quantity(session, period, cutoff=cutoff)
        credited_units = await self.get_credited_units(session, period, cutoff=cutoff)

        if period.billable:
            amount, amount_label = price.get_amount_and_label(
                float(quantity - credited_units)
            )
        else:
            amount, amount_label = 0, "Included in trial"

        return MeterPeriodSettlement(
            period=period,
            quantity=quantity,
            credited_units=credited_units,
            amount=amount,
            charge=amount - period.billed_amount,
            label=f"{period.meter.name} — {amount_label}",
        )

    async def apply_settlement(
        self,
        session: AsyncSession,
        settlement: MeterPeriodSettlement,
        *,
        close: bool = True,
    ) -> MeterPeriod:
        """``close=False`` leaves the window accruing, so a later settlement charges
        only the increase over ``billed_amount``."""
        period = settlement.period
        repository = MeterPeriodRepository.from_session(session)
        return await repository.update(
            period,
            update_dict={
                "quantity": settlement.quantity,
                "credited_units": settlement.credited_units,
                "billed_amount": settlement.amount,
                "status": (
                    MeterPeriodStatus.settled if close else MeterPeriodStatus.accruing
                ),
            },
        )

    async def compute_corrections(
        self,
        session: AsyncSession,
        subscription: Subscription,
        *,
        cutoff: datetime,
    ) -> Sequence[MeterPeriodSettlement]:
        """
        Settled periods whose window has gained usage since it was billed.

        Entries are created by a cron behind a watermark, so a window is always
        settled before the last of its entries exists. Rechecking the period settled
        at the previous invoice and charging the increase over ``billed_amount``
        recovers them — the equivalent of an entry simply staying pending.

        Bounded to that one period per meter because an invoice is the only thing
        that runs this, so anything older has already had its chance.
        """
        repository = MeterPeriodRepository.from_session(session)
        periods = await repository.get_last_settled_by_subscription(
            subscription.id, options=repository.get_eager_options()
        )

        corrections: list[MeterPeriodSettlement] = []
        for period in periods:
            settlement = await self.compute_settlement(session, period, cutoff=cutoff)
            # Only an increase is billed. A decrease is possible for `min` and `avg`
            # meters and is not refunded here.
            if settlement.charge > 0:
                corrections.append(settlement)
        return corrections

    async def get_rollover_units(
        self,
        session: AsyncSession,
        period: MeterPeriod,
        *,
        cutoff: datetime | None = None,
    ) -> Decimal:
        """Unused units eligible to carry into the next period, capped by the balance."""
        meter = period.meter
        event_repository = EventRepository.from_session(session)
        statement = (
            self._events_statement(event_repository, period, cutoff)
            .where(
                Event.organization_id == meter.organization_id,
                Event.customer_id == period.subscription.customer_id,
                Event.source == EventSource.system,
                Event.name == SystemEvent.meter_credited,
            )
            .order_by(None)
            .order_by(Event.timestamp.asc())
        )
        credit_events = await event_repository.get_all(statement)
        rollover_units = non_negative_running_sum(
            event.user_metadata["units"]
            for event in credit_events
            if event.user_metadata["rollover"]
        )
        granted = non_negative_running_sum(
            event.user_metadata["units"] for event in credit_events
        )
        quantity = await self.get_quantity(session, period, cutoff=cutoff)
        balance = Decimal(granted) - quantity

        return max(Decimal(0), min(balance, Decimal(rollover_units)))

    def _events_statement(
        self,
        event_repository: EventRepository,
        period: MeterPeriod,
        cutoff: datetime | None,
    ) -> Select[tuple[Event]]:
        return event_repository.get_by_entries_in_window_statement(
            period.subscription_id,
            period.meter_id,
            starts_at=period.starts_at,
            ends_at=self._window_end(period, cutoff),
        )

    def _window_end(self, period: MeterPeriod, cutoff: datetime | None) -> datetime:
        return min(period.ends_at, cutoff or utc_now())


meter_period = MeterPeriodService()
