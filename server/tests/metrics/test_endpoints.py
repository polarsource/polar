import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.kit.time_queries import TimeInterval
from polar.models import UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestGetMetrics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_over_limits(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2023-01-01",
                "end_date": "2024-12-31",
                "interval": "day",
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization: UserOrganization
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

    @pytest.mark.parametrize(
        "timezone",
        [
            "Europe/Paris",
            "America/New_York",
            "Asia/Rangoon",
            "Asia/Calcutta",
            "Asia/Kolkata",
        ],
    )
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_timezones(self, timezone: str, client: AsyncClient) -> None:
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
                "timezone": timezone,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12


@pytest.mark.asyncio
class TestFocusMetrics:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_invalid_metric_slugs(self, client: AsyncClient) -> None:
        """Test that invalid metric slugs return validation error."""
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
                "focus_metrics": ["revenue", "invalid_metric", "another_invalid"],
            },
        )

        assert response.status_code == 422
        json = response.json()
        assert "focus_metrics" in str(json)
        assert "invalid_metric" in str(json) or "another_invalid" in str(json)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_valid_focus_metrics(self, client: AsyncClient) -> None:
        """Test that valid focus_metrics returns only requested metrics."""
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
                "focus_metrics": ["revenue", "orders"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["periods"]) == 12

        # Requested metrics should have non-null definitions
        assert json["metrics"]["revenue"] is not None
        assert json["metrics"]["orders"] is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_single_focus_metric(self, client: AsyncClient) -> None:
        """Test that a single focus_metric works correctly."""
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
                "focus_metrics": ["active_subscriptions"],
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["metrics"]["active_subscriptions"] is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    @pytest.mark.parametrize(
        "focus_metrics",
        [
            ["gross_margin"],
            ["gross_margin_percentage"],
            ["cashflow"],
            ["churn_rate"],
            ["ltv"],
        ],
    )
    async def test_meta_metrics(
        self, focus_metrics: list[str], client: AsyncClient
    ) -> None:
        """Test that meta metrics (post-compute metrics) can be requested."""
        response = await client.get(
            "/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "month",
                "focus_metrics": focus_metrics,
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["metrics"][focus_metrics[0]] is not None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_without_focus_metrics_returns_all(self, client: AsyncClient) -> None:
        """Test that omitting focus_metrics returns all metrics (backward compatible)."""
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

        # All metrics should be present when focus_metrics is not specified
        assert json["metrics"]["revenue"] is not None
        assert json["metrics"]["orders"] is not None
        assert json["metrics"]["active_subscriptions"] is not None
        assert json["metrics"]["gross_margin"] is not None


@pytest.mark.asyncio
class TestGetMetricsLimits:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/limits")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.metrics_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read}),
    )
    async def test_valid(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/limits")

        assert response.status_code == 200

        json = response.json()
        assert "min_date" in json
        intervals = json["intervals"]
        for interval in TimeInterval:
            assert interval.name in intervals
            assert intervals[interval.name]["max_days"] > 0
