import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Organization, UserOrganization


@pytest.mark.asyncio
class TestOnboardingEndpoints:
    async def test_all_endpoints_require_auth(self, client: AsyncClient) -> None:
        """All onboarding endpoints require authentication."""
        endpoints = [
            ("/v1/onboarding/started", {"signup_method": "github"}),
            ("/v1/onboarding/step/org/started", {"session_id": "test"}),
            ("/v1/onboarding/step/org/completed", {"session_id": "test"}),
            ("/v1/onboarding/step/org/skipped", {"session_id": "test"}),
            (
                "/v1/onboarding/completed",
                {"session_id": "test", "organization_id": "test"},
            ),
        ]
        for endpoint, payload in endpoints:
            response = await client.post(endpoint, json=payload)
            assert response.status_code == 401, f"{endpoint} should require auth"

    @pytest.mark.auth
    async def test_started_returns_session(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
    ) -> None:
        """New users get a session with experiment info."""
        mocker.patch("polar.onboarding.service.posthog")

        response = await client.post(
            "/v1/onboarding/started",
            json={
                "signup_method": "github",
                "experiment_name": "onboarding_flow_v1",
                "experiment_variant": "treatment",
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["session_id"] is not None
        assert json["current_step"] == "org"
        assert json["experiment_variant"] == "treatment"

    @pytest.mark.auth
    async def test_started_rejects_user_with_orgs(
        self,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Users with existing organizations get 400."""
        mocker.patch("polar.onboarding.service.posthog")

        response = await client.post(
            "/v1/onboarding/started",
            json={"signup_method": "github"},
        )

        assert response.status_code == 400

    @pytest.mark.auth
    async def test_invalid_step_rejected(self, client: AsyncClient) -> None:
        """Invalid step values are rejected."""
        response = await client.post(
            "/v1/onboarding/step/invalid/started",
            json={"session_id": "test"},
        )
        assert response.status_code == 422
