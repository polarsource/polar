from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import OrganizationReview
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_organization_review,
)

REASON = "Please reconsider my account — here is the additional context for the review."


@pytest_asyncio.fixture
async def denied_review(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationReview:
    return await create_organization_review(
        save_fixture,
        organization,
        appeal_decision=OrganizationReview.AppealDecision.REJECTED,
    )


@pytest.mark.asyncio
class TestRequestHumanReview:
    async def test_unauthorized(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "review_appeal"

    @pytest.mark.auth
    async def test_reason_too_short(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": "too short"},
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_duplicate(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason=REASON,
            requested_by_user=user,
            organization=organization,
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 409

    @pytest.mark.auth
    async def test_rejects_when_appeal_not_rejected(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Appeal still pending (AI hasn't decided): a human-review case cannot
        # be opened yet — the frontend gate is enforced server-side too.
        await create_organization_review(
            save_fixture,
            organization,
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="My pending appeal.",
        )

        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 409
