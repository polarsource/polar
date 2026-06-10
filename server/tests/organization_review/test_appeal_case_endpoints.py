import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.models import OrganizationReview
from polar.models.organization import Organization
from polar.models.support_case import SupportCaseMessageAuthorKind
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

REASON = "Please reconsider my account — here is the additional context for the review."


@pytest_asyncio.fixture
async def denied_review(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationReview:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="Automated review denied.",
        model_used="test",
        appeal_decision=OrganizationReview.AppealDecision.REJECTED,
    )
    await save_fixture(review)
    return review


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
        assert data["is_open"] is True

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
            session, denied_review, reason=REASON, requested_by_user_id=user.id
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/human-review",
            json={"reason": REASON},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
class TestGetAppealCase:
    @pytest.mark.auth
    async def test_not_found_without_case(
        self,
        client: AsyncClient,
        organization: Organization,
        denied_review: OrganizationReview,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_returns_thread(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session, denied_review, reason=REASON, requested_by_user_id=user.id
        )
        await session.flush()
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 200
        data = response.json()
        assert data["case"]["is_open"] is True
        assert REASON in [m["body"] for m in data["messages"]]

    @pytest.mark.auth
    async def test_internal_note_hidden(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await appeal_case_service.request_human_review(
            session, denied_review, reason=REASON, requested_by_user_id=user.id
        )
        await appeal_case_service.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user_id=user.id,
            body="internal staff note",
            internal=True,
        )
        await session.flush()
        response = await client.get(f"/v1/organizations/{organization.id}/appeal/case")
        assert response.status_code == 200
        assert "internal staff note" not in [
            m["body"] for m in response.json()["messages"]
        ]


@pytest.mark.asyncio
class TestReplyToAppealCase:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        await appeal_case_service.request_human_review(
            session, denied_review, reason=REASON, requested_by_user_id=user.id
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"body": "here is more detail"},
        )
        assert response.status_code == 200
        assert response.json()["body"] == "here is more detail"

    @pytest.mark.auth
    async def test_locked_after_decision(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        denied_review: OrganizationReview,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        case = await appeal_case_service.request_human_review(
            session, denied_review, reason=REASON, requested_by_user_id=user.id
        )
        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user_id=user.id, reason="final"
        )
        await session.flush()
        response = await client.post(
            f"/v1/organizations/{organization.id}/appeal/case/messages",
            json={"body": "please reconsider again"},
        )
        assert response.status_code == 422
