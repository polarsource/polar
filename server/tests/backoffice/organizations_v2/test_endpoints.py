from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_session import UserSession
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import AUPSection
from polar.postgres import AsyncSession, get_db_session


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestDenyDialog:
    async def test_stores_violated_aup_section(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "pp_19_trading_financial",
            },
        )

        assert response.status_code == 303

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is not None
        assert current.violated_aup_section == AUPSection.PP_19_TRADING_FINANCIAL

    async def test_missing_aup_section_does_not_deny(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={"override_reason": "Crypto trading bot"},
        )

        assert response.status_code == 200
        assert "An AUP section is required" in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None

    async def test_invalid_aup_section_does_not_deny(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        response = await backoffice_client.post(
            f"/organizations/{organization.id}/deny-dialog",
            data={
                "override_reason": "Crypto trading bot",
                "violated_aup_section": "not_a_section",
            },
        )

        assert response.status_code == 200
        assert "Invalid AUP section." in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None


@pytest.mark.asyncio
class TestOffboardDialog:
    async def test_missing_aup_section_does_not_offboard(
        self,
        backoffice_client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        previous_status = organization.status

        response = await backoffice_client.post(
            f"/organizations/{organization.id}/offboard-dialog",
            data={"reason": "Policy violation"},
        )

        assert response.status_code == 200
        assert "An AUP section is required" in response.text

        current = await OrganizationReviewRepository.from_session(
            session
        ).get_current_decision(organization.id)
        assert current is None
        assert organization.status == previous_status
