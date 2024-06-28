import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.metrics.queries import Interval
from polar.models import UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetMetrics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_over_limits(
        self, client: AsyncClient, user_organization_admin: UserOrganization
    ) -> None:
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "day",
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization_admin: UserOrganization
    ) -> None:
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetMetricsLimits:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/limits")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read}),
    )
    async def test_valid(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/limits")

        assert response.status_code == 200

        json = response.json()
        assert "min_date" in json
        intervals = json["intervals"]
        for interval in Interval:
            assert interval.name in intervals
            assert intervals[interval.name]["max_days"] > 0
