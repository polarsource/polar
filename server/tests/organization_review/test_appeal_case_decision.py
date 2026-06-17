"""Decision orchestration performed by the backoffice support-case handlers.

The backoffice runs as a separately-mounted sub-app, so its HTTP handlers are
not exercised through the standard test client. These tests cover the exact
service orchestration the approve/deny handlers perform — the genuinely new
behavior the backoffice introduces — independent of the HTTP layer.
"""

from datetime import UTC, datetime

import pytest
import pytest_asyncio

from polar.models import OrganizationReview
from polar.models.organization import Organization, OrganizationStatus
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseAudience,
    SupportCaseMessageType,
)
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.organization_review.appeal_case import (
    CaseClosedError,
)
from polar.organization_review.appeal_case import (
    appeal_case as appeal_case_service,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseMessageRepository
from tests.fixtures.database import SaveFixture

REASON = "Please reconsider — here is the additional context for the review."


@pytest_asyncio.fixture
async def denied_review_with_case(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> tuple[Organization, OrganizationReview, ReviewAppealSupportCase]:
    """A denied org whose AI appeal was already rejected, with an open case.

    This is the real precondition a human-review case is opened in: the org is
    DENIED and ``appeal_decision`` is already REJECTED.
    """
    organization.status = OrganizationStatus.DENIED
    await save_fixture(organization)

    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="Automated review denied.",
        model_used="test",
        appeal_submitted_at=datetime.now(UTC),
        appeal_reason="My earlier appeal text.",
        appeal_reviewed_at=datetime.now(UTC),
        appeal_decision=OrganizationReview.AppealDecision.REJECTED,
    )
    await save_fixture(review)

    case = await appeal_case_service.request_human_review(
        session,
        review,
        reason=REASON,
        requested_by_user=user,
        organization=organization,
    )
    return organization, review, case


@pytest.mark.asyncio
class TestApproveDecision:
    async def test_reactivates_org_and_closes_case(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
        user: User,
    ) -> None:
        organization, review, case = denied_review_with_case

        # Every approval entry point funnels through backoffice_approve, which
        # now closes the open appeal case itself — no path can reactivate the
        # org while leaving the case open.
        await organization_service.backoffice_approve(
            session,
            organization,
            reason="Looks legitimate after human review.",
            staff_user=user,
        )

        # Org reactivated (CREATED, since onboarding gates aren't met in tests).
        assert organization.status != OrganizationStatus.DENIED
        # backoffice_approve flips the already-rejected appeal to APPROVED.
        assert review.appeal_decision == OrganizationReview.AppealDecision.APPROVED

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False
        merchant_messages = await message_repository.list_by_case(
            case.id, visible_to=SupportCaseAudience.merchant
        )
        assert any(
            m.type == SupportCaseMessageType.appeal_approved for m in merchant_messages
        )

    async def test_approve_without_open_case_is_noop(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # A denied org whose appeal never escalated to a human-review case:
        # approval still reactivates and records the decision, with no case to
        # close and no error.
        organization.status = OrganizationStatus.DENIED
        await save_fixture(organization)
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=90.0,
            violated_sections=[],
            reason="Automated review denied.",
            model_used="test",
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="My appeal text.",
            appeal_reviewed_at=datetime.now(UTC),
            appeal_decision=OrganizationReview.AppealDecision.REJECTED,
        )
        await save_fixture(review)

        await organization_service.backoffice_approve(
            session, organization, reason="No case here.", staff_user=user
        )

        assert organization.status != OrganizationStatus.DENIED
        assert review.appeal_decision == OrganizationReview.AppealDecision.APPROVED

    async def test_approve_open_case_is_noop_on_closed_case(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
        user: User,
    ) -> None:
        # Once the case is closed (here, denied), approving must not write a
        # conflicting decision onto it — it's a no-op, so no inconsistent
        # approved-message-on-a-denied-case record is created.
        _organization, review, case = denied_review_with_case
        await appeal_case_service.deny_open_case(
            session, review, staff_user=user, reason="Denied."
        )
        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False

        result = await appeal_case_service.approve_open_case(
            session, review, staff_user=user, reason="Override."
        )

        assert result is None
        messages = await message_repository.list_by_case(
            case.id, visible_to=SupportCaseAudience.merchant
        )
        assert not [
            m for m in messages if m.type == SupportCaseMessageType.appeal_approved
        ]

    async def test_approve_appeal_would_reject_already_reviewed(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
    ) -> None:
        # Documents why approve uses backoffice_approve, not approve_appeal:
        # the appeal is already decided, so approve_appeal refuses.
        organization, _review, _case = denied_review_with_case
        with pytest.raises(ValueError, match="already been reviewed"):
            await organization_service.approve_appeal(session, organization)


@pytest.mark.asyncio
class TestDenyDecision:
    async def test_closes_case_and_org_stays_denied(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
        user: User,
    ) -> None:
        organization, review, case = denied_review_with_case

        # What appeal_case_deny_dialog does on POST (org needs no status change).
        await appeal_case_service.record_decision(
            session,
            case,
            approved=False,
            staff_user=user,
            reason="Still doesn't meet policy.",
        )

        assert organization.status == OrganizationStatus.DENIED
        assert review.appeal_decision == OrganizationReview.AppealDecision.REJECTED

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False
        merchant_messages = await message_repository.list_by_case(
            case.id, visible_to=SupportCaseAudience.merchant
        )
        assert any(
            m.type == SupportCaseMessageType.appeal_denied for m in merchant_messages
        )

    async def test_decision_locks_the_case(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
        user: User,
    ) -> None:
        _organization, _review, case = denied_review_with_case

        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="final"
        )

        # A second decision must fail once the case is locked. (Reply-after-lock
        # is covered by test_appeal_case.py::TestReplyAndLock.)
        with pytest.raises(CaseClosedError):
            await appeal_case_service.record_decision(
                session, case, approved=True, staff_user=user, reason="oops"
            )

    async def test_deny_open_case_closes_open_case(
        self,
        session: AsyncSession,
        denied_review_with_case: tuple[
            Organization, OrganizationReview, ReviewAppealSupportCase
        ],
        user: User,
    ) -> None:
        # The deny twin of approve_open_case: keeps the case in sync on any
        # deny path, like backoffice_approve does for approval.
        _organization, review, case = denied_review_with_case

        await appeal_case_service.deny_open_case(
            session, review, staff_user=user, reason="Still doesn't meet policy."
        )

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False
        merchant_messages = await message_repository.list_by_case(
            case.id, visible_to=SupportCaseAudience.merchant
        )
        assert any(
            m.type == SupportCaseMessageType.appeal_denied for m in merchant_messages
        )
