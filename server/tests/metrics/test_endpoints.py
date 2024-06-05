import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetMetrics:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/metrics/")

        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_metrics_read}),
    )
    async def test_user_valid(
        self, client: AsyncClient, user_organization_admin: UserOrganization
    ) -> None:
        response = await client.get(
            "/api/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "day",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 366  # Leap year!

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.creator_metrics_read})
    )
    async def test_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/metrics/",
            params={
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "interval": "day",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 366  # Leap year!
