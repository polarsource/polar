import asyncio
import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import ValidationError

from polar.exceptions import ResourceNotFound
from polar.models import VoidMeter as Meter
from polar.postgres import AsyncSession
from polar.void.metric import compare as module
from polar.void.metric.compare import CompareQuery
from polar.void.metric.schemas import Metrics, MetricSeries, MetricsQuery
from polar.void.metric.service import metric as metric_service
from polar.void.tinybird import TinybirdApi
from tests.fixtures.auth import AuthSubjectFixture

pytestmark = pytest.mark.auth(AuthSubjectFixture(subject="organization"))


def query(**overrides: Any) -> CompareQuery:
    return CompareQuery.model_validate(
        {
            "baseline": "a" * 64,
            "candidate": "b" * 64,
            "start": "2026-01-01",
            "end": "2026-02-01",
            **overrides,
        }
    )


def test_compare_uses_baseline_subscriptions_and_candidate_prices(
    scenario: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    scenario.current.version_id = "a" * 64
    candidate = Meter(
        id=uuid.uuid4(),
        organization_id=scenario.current.organization_id,
        slug="tokens",
        version_id="b" * 64,
        usage_reducer_id=scenario.usage_id,
        credit_reducer_id=scenario.credit_id,
        unit_amount=Decimal("0.003"),
        currency="usd",
    )
    scenario.meters.append(candidate)
    # Credits alone in another version must not add Orbit to this comparison.
    del scenario.events[scenario.current.id, "orbit"]
    for reducer in scenario.reducers:
        reducer.aggregation.type = "scalar"

    async def get_metrics(
        session: AsyncSession,
        organization_id: uuid.UUID,
        request: MetricsQuery,
        *,
        root_ids: Sequence[str],
    ) -> Metrics:
        assert organization_id == scenario.current.organization_id
        assert root_ids == ["acme"]
        return Metrics(
            reducer_id=request.reducer_id,
            interval=request.interval,
            series=[
                MetricSeries(
                    external_identity_id=None,
                    external_root_id=None,
                    periods=[],
                    total=123,
                )
            ],
        )

    metrics = AsyncMock(side_effect=get_metrics)
    monkeypatch.setattr(metric_service, "get", metrics)
    session = AsyncMock()
    result = asyncio.run(
        module.compare(
            session,
            Mock(spec=TinybirdApi),
            scenario.auth_subject,
            query(),
        )
    )
    assert result.baseline == "a" * 64
    assert result.candidate == "b" * 64
    assert result.customer_count == 1
    assert len(result.shared_metrics) == 2
    preview = result.meters[0].price_preview
    assert preview is not None
    assert preview.current_amount == Decimal(20)
    assert preview.proposed_amount == Decimal(30)
    assert preview.difference == Decimal(10)
    assert [customer.external_id for customer in preview.customers] == ["acme"]
    session.add.assert_not_called()
    session.flush.assert_not_called()
    assert scenario.current.unit_amount == Decimal("0.002")


def test_same_version_compares_unchanged_meter_and_exposes_missing_matches(
    scenario: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    scenario.current.version_id = "a" * 64
    for reducer in scenario.reducers:
        reducer.aggregation.type = "dict"  # No scalar metrics needed here.
    result = asyncio.run(
        module.compare(
            AsyncMock(),
            Mock(spec=TinybirdApi),
            scenario.auth_subject,
            query(baseline="a" * 64, candidate="a" * 64),
        )
    )
    assert result.meters[0].price_preview is not None
    assert result.meters[0].price_preview.difference == 0
    assert result.meters[0].price_preview.billable_units == 35000
    candidate = Meter(
        id=uuid.uuid4(),
        organization_id=scenario.current.organization_id,
        slug="other",
        version_id="b" * 64,
        usage_reducer_id=scenario.usage_id,
        credit_reducer_id=scenario.credit_id,
        unit_amount=Decimal("0.003"),
        currency="usd",
    )
    scenario.meters.append(candidate)
    result = asyncio.run(
        module.compare(
            AsyncMock(),
            Mock(spec=TinybirdApi),
            scenario.auth_subject,
            query(baseline="a" * 64),
        )
    )
    assert all(entry.price_preview is None and entry.reason for entry in result.meters)


def test_unknown_or_other_organization_version_is_rejected_before_history(
    scenario: SimpleNamespace,
) -> None:
    with pytest.raises(ResourceNotFound):
        asyncio.run(
            module.compare(
                AsyncMock(),
                Mock(spec=TinybirdApi),
                scenario.auth_subject,
                query(),
            )
        )
    scenario.read_buckets.assert_not_called()


def test_comparison_dates_are_validated() -> None:
    with pytest.raises(ValidationError, match="start must be before end"):
        query(start="2026-02-01")
    with pytest.raises(ValidationError):
        query(baseline="")
    with pytest.raises(ValidationError, match="today or earlier"):
        query(end=date.max)


def test_candidate_with_deleted_reducer_is_rejected(scenario: SimpleNamespace) -> None:
    scenario.current.version_id = "a" * 64
    scenario.reducers.pop()
    with pytest.raises(ResourceNotFound, match="deleted reducer"):
        asyncio.run(
            module.compare(
                AsyncMock(),
                Mock(spec=TinybirdApi),
                scenario.auth_subject,
                query(baseline="a" * 64, candidate="a" * 64),
            )
        )
    scenario.read_buckets.assert_not_called()
