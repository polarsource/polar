import asyncio
import copy
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import ValidationError

from polar.auth.models import AuthSubject
from polar.models import Organization
from polar.models import VoidMeter as Meter
from polar.postgres import AsyncSession
from polar.void.customer.service import customer as customer_service
from polar.void.deploy import preview as module
from polar.void.deploy.preview_repository import PreviewRepository
from polar.void.deploy.schemas import (
    Deploy,
    DeployCreate,
    DeployEntry,
    PricePreviewWindow,
)
from polar.void.identity.service import identity as identity_service
from polar.void.meter.balance import MeterEvent
from polar.void.meter.service import meter as meter_service
from polar.void.reducer.service import reducer as reducer_service
from polar.void.tinybird import TinybirdApi
from tests.fixtures.auth import AuthSubjectFixture

pytestmark = pytest.mark.auth(AuthSubjectFixture(subject="organization"))


def at(month: int, day: int = 1) -> datetime:
    return datetime(2026, month, day, tzinfo=UTC)


@pytest.fixture
def scenario(
    monkeypatch: pytest.MonkeyPatch, auth_subject: AuthSubject[Organization]
) -> SimpleNamespace:
    org = auth_subject.subject.id
    usage_id, credit_id = uuid.uuid4(), uuid.uuid4()
    current = Meter(
        id=uuid.uuid4(),
        organization_id=org,
        name="Tokens",
        slug="tokens",
        generation_id=1,
        branch_id=None,
        usage_reducer_id=usage_id,
        credit_reducer_id=credit_id,
        unit_amount=Decimal("0.002"),
        currency="usd",
    )
    reducers = [
        SimpleNamespace(
            id=usage_id, slug="tokens", aggregation=SimpleNamespace(func="sum")
        ),
        SimpleNamespace(
            id=credit_id, slug="tokens-credits", aggregation=SimpleNamespace(func="sum")
        ),
    ]
    customers = [
        SimpleNamespace(external_id=name.lower(), name=name)
        for name in ("Acme", "Orbit")
    ]

    async def get_identity(
        session: AsyncSession, organization_id: uuid.UUID, external_id: str
    ) -> SimpleNamespace:
        assert organization_id == org
        return SimpleNamespace(
            external_id=external_id, organization_id=org, parent_id=None
        )

    monkeypatch.setattr(identity_service, "get", get_identity)
    # These stand in for already materialized subtree totals. There is no
    # usage-event source available to the preview. Main represents recurring
    # allowances as credit buckets, rather than grants on subscription terms.
    buckets = {
        "acme": {
            usage_id: [(at(1, 15), 12000), (at(2, 15), 22000)],
            credit_id: [(at(1), 2000), (at(2), 2000)],
        },
        "orbit": {
            usage_id: [(at(1, 15), 27000)],
            credit_id: [(at(1), 2000), (at(2), 2000)],
        },
    }
    events = {
        (current.id, customer.external_id): [
            MeterEvent(
                id=f"sub-{customer.external_id}",
                at=at(1),
                name="subscription.created",
                data={
                    "meter_interval": "month",
                    "rollover_cap": 0,
                },
            )
        ]
        for customer in customers
    }
    meters = [current]
    monkeypatch.setattr(meter_service, "list", AsyncMock(return_value=meters))
    monkeypatch.setattr(reducer_service, "list", AsyncMock(return_value=reducers))
    monkeypatch.setattr(customer_service, "list", AsyncMock(return_value=customers))

    async def read_events(
        tinybird: TinybirdApi,
        meter: Meter,
        identities: list[str],
        start: datetime,
        end: datetime,
    ) -> list[MeterEvent]:
        assert meter.organization_id == org
        return [e for e in events.get((meter.id, identities[0]), []) if e.at <= end]

    async def read_values(
        reducer: Any, external_id: str, end: datetime, *, actor: bool
    ) -> list[tuple[datetime, float]]:
        assert actor == (reducer.id == credit_id)
        return [
            (timestamp, value)
            for timestamp, value in buckets[external_id][reducer.id]
            if timestamp < end
        ]

    monkeypatch.setattr(meter_service, "_events", read_events)
    read_buckets = AsyncMock(side_effect=read_values)
    monkeypatch.setattr(
        PreviewRepository,
        "from_session",
        lambda session: SimpleNamespace(buckets=read_buckets),
    )
    create_meter = AsyncMock(side_effect=AssertionError("must not create a meter"))
    create_reducer = AsyncMock(side_effect=AssertionError("must not process reducers"))
    monkeypatch.setattr(meter_service, "create", create_meter)
    monkeypatch.setattr(reducer_service, "create", create_reducer)
    request = DeployCreate.model_validate(
        {
            "checksum": "candidate",
            "dry_run": True,
            "meters": [{"slug": "tokens", "reducer": "tokens", "unit_amount": "0.003"}],
            "preview": {"start": "2026-01-01", "end": "2026-02-01"},
        }
    )

    async def run() -> Any:
        plan = Deploy(
            id=None,
            variant_id=None,
            checksum="candidate",
            applied=False,
            created_at=at(3),
            entries=[
                DeployEntry(
                    kind="meter",
                    key="tokens",
                    action="replace",
                    id=None,
                    reason=None,
                    price_preview=None,
                )
            ],
        )
        session = AsyncMock()
        await module.preview_prices(
            session, Mock(spec=TinybirdApi), auth_subject, request, plan
        )
        session.add.assert_not_called()
        session.flush.assert_not_called()
        create_meter.assert_not_called()
        create_reducer.assert_not_called()
        return plan.entries[0].price_preview

    return SimpleNamespace(
        auth_subject=auth_subject,
        run=run,
        request=request,
        current=current,
        meters=meters,
        reducers=reducers,
        customers=customers,
        buckets=buckets,
        events=events,
        usage_id=usage_id,
        credit_id=credit_id,
        read_buckets=read_buckets,
    )


def test_reprices_same_processed_usage_without_writes(
    scenario: SimpleNamespace,
) -> None:
    original = copy.deepcopy(scenario.buckets)
    preview = asyncio.run(scenario.run())
    assert preview.unavailable is None
    assert preview.billable_units == Decimal(35000)
    assert preview.current_amount == Decimal(70)
    assert preview.proposed_amount == Decimal(105)
    assert preview.difference == Decimal(35)
    assert [(r.external_id, r.billable_units) for r in preview.customers] == [
        ("orbit", 25000),
        ("acme", 10000),
    ]
    assert scenario.buckets == original
    assert scenario.current.unit_amount == Decimal("0.002")
    assert scenario.read_buckets.await_count == 4  # Two reducers per customer, once.


def test_period_excludes_prior_cycles_and_includes_open_period(
    scenario: SimpleNamespace,
) -> None:
    scenario.request.preview = PricePreviewWindow(
        start=date(2026, 2, 1), end=date(2026, 2, 20)
    )
    preview = asyncio.run(scenario.run())
    assert preview.billable_units == Decimal(20000)
    assert preview.current_amount == Decimal(40)
    assert preview.proposed_amount == Decimal(60)


def test_existing_credit_adjustments_and_rollover_are_preserved(
    scenario: SimpleNamespace,
) -> None:
    scenario.buckets["acme"][scenario.usage_id] = [(at(1, 15), 1000), (at(2, 15), 4000)]
    scenario.buckets["acme"][scenario.credit_id].extend(
        [(at(2, 10), 500), (at(2, 12), -100)]
    )
    scenario.events[(scenario.current.id, "acme")][0].data["rollover_cap"] = 1000
    scenario.request.preview = PricePreviewWindow(
        start=date(2026, 2, 1), end=date(2026, 3, 1)
    )
    preview = asyncio.run(scenario.run())
    acme = next(r for r in preview.customers if r.external_id == "acme")
    # 4,000 usage - 2,000 included - 1,000 rollover - 400 credits.
    assert acme.billable_units == Decimal(600)
    assert acme.current_amount == Decimal("1.2")


@pytest.mark.parametrize("price", ["0", "0.001", "0.002000000001"])
def test_zero_decreased_and_subcent_prices(
    scenario: SimpleNamespace, price: str
) -> None:
    scenario.request.meters[0].unit_amount = Decimal(price)
    preview = asyncio.run(scenario.run())
    assert preview.proposed_amount == Decimal(35000) * Decimal(price)
    assert preview.difference == preview.proposed_amount - Decimal(70)


def test_pinned_old_generation_is_counted_once(scenario: SimpleNamespace) -> None:
    replacement = Meter(
        id=uuid.uuid4(),
        organization_id=scenario.current.organization_id,
        slug="tokens",
        generation_id=2,
        branch_id=None,
        usage_reducer_id=scenario.usage_id,
        credit_reducer_id=scenario.credit_id,
        unit_amount=Decimal("0.0025"),
        currency="usd",
    )
    scenario.meters.append(replacement)
    # A branch must never become the reference price or a second usage source.
    scenario.meters.append(
        Meter(slug="tokens", generation_id=99, branch_id=uuid.uuid4())
    )
    scenario.meters.append(
        Meter(slug="tokens", generation_id=100, variant_id="candidate")
    )
    preview = asyncio.run(scenario.run())
    assert preview.current_unit_amount == Decimal("0.0025")
    assert preview.billable_units == Decimal(35000)
    assert preview.current_amount == Decimal("87.5")


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ("currency", "Currency"),
        ("reducer", "reducers"),
        ("aggregation", "sum and count"),
    ],
)
def test_incompatible_changes_are_explicit(
    scenario: SimpleNamespace, change: str, message: str
) -> None:
    if change == "currency":
        scenario.request.meters[0].currency = "eur"
    elif change == "reducer":
        scenario.request.meters[0].reducer = "new-tokens"
    else:
        scenario.reducers[0].aggregation.func = "max"
    preview = asyncio.run(scenario.run())
    assert message in preview.unavailable
    assert preview.customers == []


def test_unaligned_subscription_is_excluded_from_totals(
    scenario: SimpleNamespace,
) -> None:
    scenario.events[(scenario.current.id, "acme")][0].at = at(1).replace(minute=1)
    preview = asyncio.run(scenario.run())
    assert preview.billable_units == Decimal(25000)
    assert preview.excluded_customers == [
        "acme: subscription changes are not aligned to five-minute buckets"
    ]


def test_no_customers_is_not_a_fabricated_revenue_estimate(
    scenario: SimpleNamespace,
) -> None:
    scenario.customers.clear()
    preview = asyncio.run(scenario.run())
    assert preview.customers == []
    assert preview.current_amount == 0


def test_unchanged_price_has_no_preview(scenario: SimpleNamespace) -> None:
    scenario.request.meters[0].unit_amount = Decimal("0.002")
    assert asyncio.run(scenario.run()) is None


def test_preview_rejects_apply_and_reversed_dates() -> None:
    with pytest.raises(ValidationError, match="requires dry_run"):
        DeployCreate.model_validate(
            {"checksum": "x", "preview": {"start": "2026-01-01", "end": "2026-02-01"}}
        )
    with pytest.raises(ValidationError, match="start must be before end"):
        PricePreviewWindow(start=date(2026, 2, 1), end=date(2026, 1, 1))
