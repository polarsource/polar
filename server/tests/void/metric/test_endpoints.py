from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import (
    Organization,
    VoidReducer,
    VoidReducerBucket,
    VoidReducerDependency,
)
from polar.postgres import AsyncSession
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.metric.schemas import MetricsQuery, TimeInterval
from polar.void.metric.service import metric as metric_service
from polar.void.reducer.aggregation import (
    CountAggregation,
    DerivedAggregation,
    PropertyAggregation,
    RecordAggregation,
)
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

START = datetime(2026, 1, 1, tzinfo=UTC)
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


async def bucket(
    save_fixture: SaveFixture,
    organization: Organization,
    reducer: VoidReducer,
    day: int,
    value: float | None,
    actor: str = "leaf",
    root: str = "root",
    data: dict[str, object] | None = None,
) -> VoidReducerBucket:
    result = VoidReducerBucket(
        organization=organization,
        reducer=reducer,
        external_identity_id=actor,
        external_root_id=root,
        bucket_start=START + timedelta(days=day),
        value=value,
        data=data,
    )
    await save_fixture(result)
    return result


@pytest.mark.asyncio
class TestMetrics:
    async def test_tree_scope_grouping_cumulative_and_tenant_boundary(
        self,
        void_client: AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        for external_id, parent in (
            ("root", None),
            ("child", "root"),
            ("leaf", "child"),
            ("sibling", "root"),
        ):
            await identity_service.ensure(
                session,
                organization,
                IdentityCreate(external_id=external_id, parent_external_id=parent),
            )
        reducer = VoidReducer(
            organization=organization, slug="count", aggregation=CountAggregation()
        )
        other = VoidReducer(
            organization=organization_second,
            slug="count",
            aggregation=CountAggregation(),
        )
        await save_fixture(reducer)
        await save_fixture(other)
        await bucket(save_fixture, organization, reducer, -1, 5)
        await bucket(save_fixture, organization, reducer, 0, 2)
        await bucket(save_fixture, organization, reducer, 2, 3)
        await bucket(save_fixture, organization, reducer, 0, 40, "sibling")
        await bucket(save_fixture, organization_second, other, 0, 1000)
        deleted = await bucket(save_fixture, organization, reducer, 1, 1000)
        deleted.deleted_at = START
        await save_fixture(deleted)
        query = {
            "reducer_id": str(reducer.id),
            "start": START.isoformat(),
            "end": (START + timedelta(days=3)).isoformat(),
            "interval": "day",
            "external_identity_id": "child",
            "group_by": "external_identity_id",
            "cumulative": "true",
        }
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.status_code == 200, response.text
        series = response.json()["series"]
        assert len(series) == 1
        assert series[0]["external_identity_id"] == "leaf"
        assert [period["value"] for period in series[0]["periods"]] == [7, 7, 10]
        assert series[0]["total"] == 10
        query.update(
            external_identity_id="root", group_by="external_root_id", cumulative="false"
        )
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.json()["series"][0]["total"] == 45
        query["reducer_id"] = str(other.id)
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.status_code == 404

    async def test_derived_merges_inputs_before_evaluating(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        numerator = VoidReducer(
            organization=organization,
            slug="sum",
            aggregation=PropertyAggregation(func="sum", property="value"),
        )
        denominator = VoidReducer(
            organization=organization, slug="count", aggregation=CountAggregation()
        )
        derived = VoidReducer(
            organization=organization,
            slug="average",
            aggregation=DerivedAggregation(
                inputs={"amount": "sum", "count": "count"},
                expression="$amount / $count",
            ),
        )
        for reducer in (numerator, denominator, derived):
            await save_fixture(reducer)
        for name, source in (("amount", numerator), ("count", denominator)):
            await save_fixture(
                VoidReducerDependency(
                    organization=organization,
                    reducer=derived,
                    input_name=name,
                    source_reducer=source,
                )
            )
        await bucket(
            save_fixture,
            organization,
            derived,
            -1,
            2,
            data={"inputs": {"amount": 4, "count": 2}},
        )
        await bucket(
            save_fixture,
            organization,
            derived,
            0,
            10,
            data={"inputs": {"amount": 10, "count": 1}},
        )
        await bucket(
            save_fixture,
            organization,
            derived,
            1,
            2,
            data={"inputs": {"amount": 6, "count": 3}},
        )
        query = MetricsQuery(
            reducer_id=derived.id,
            start=START,
            end=START + timedelta(days=3),
            interval=TimeInterval.day,
        )
        result = await metric_service.get(session, organization.id, query)
        assert [point.value for point in result.series[0].periods] == [10, 2, None]
        assert result.series[0].total == 4
        query.cumulative = True
        result = await metric_service.get(session, organization.id, query)
        assert result.series[0].total == pytest.approx(20 / 6)
        result = await metric_service.get(session, organization.id, query, root_ids=[])
        assert result.series[0].total is None

    @pytest.mark.parametrize(("func", "value"), [("min", 7), ("max", -7)])
    async def test_empty_period_does_not_change_extrema_total(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        func: str,
        value: float,
    ) -> None:
        reducer = VoidReducer(
            organization=organization,
            slug=func,
            aggregation=PropertyAggregation.model_validate(
                {"func": func, "property": "value"}
            ),
        )
        await save_fixture(reducer)
        await bucket(save_fixture, organization, reducer, 1, value)
        result = await metric_service.get(
            session,
            organization.id,
            MetricsQuery(
                reducer_id=reducer.id,
                start=START,
                end=START + timedelta(days=3),
                interval=TimeInterval.day,
            ),
        )
        assert result.series[0].total == value

    async def test_rejects_non_scalar_and_invalid_period(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        reducer = VoidReducer(
            organization=organization,
            slug="last",
            aggregation=RecordAggregation(func="last"),
        )
        await save_fixture(reducer)
        query = {
            "reducer_id": str(reducer.id),
            "start": START.isoformat(),
            "end": (START + timedelta(days=1)).isoformat(),
            "interval": "day",
        }
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.status_code == 400
        query["end"] = query["start"]
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.status_code == 422
        query["start"] = "2026-01-01T00:00:00"
        query["end"] = "2026-01-02T00:00:00"
        response = await void_client.get(
            "/v1/void/metrics", params=query, headers=HEADERS
        )
        assert response.status_code == 422
