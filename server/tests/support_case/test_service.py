import pytest

from polar.models import Organization, OrganizationReview, User
from polar.models.support_case import ReviewAppealSupportCase, SupportCaseMessageType
from polar.postgres import AsyncSession
from polar.support_case.service import support_case as support_case_service
from tests.fixtures.database import SaveFixture


async def _case(
    save_fixture: SaveFixture, organization: Organization
) -> ReviewAppealSupportCase:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="denied",
        model_used="test",
    )
    await save_fixture(review)
    case = ReviewAppealSupportCase(
        organization_review=review, organization=organization
    )
    await save_fixture(case)
    return case


@pytest.mark.asyncio
class TestAssignment:
    async def test_events_are_internal(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # The audience must stay empty: assignment is platform-only churn and
        # must never surface in the merchant-visible thread.
        case = await _case(save_fixture, organization)

        assigned = await support_case_service.assign(session, case, assignee=user)
        assert case.assigned_user_id == user.id
        assert assigned.type == SupportCaseMessageType.assigned
        assert assigned.audience == []

        released = await support_case_service.unassign(session, case, actor=user)
        assert case.assigned_user_id is None
        assert released.type == SupportCaseMessageType.released
        assert released.audience == []
