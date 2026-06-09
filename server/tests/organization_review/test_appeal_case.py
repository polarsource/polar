import pytest
import pytest_asyncio

from polar.models import OrganizationReview
from polar.models.organization import Organization
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
    SupportCaseType,
)
from polar.models.user import User
from polar.organization_review.appeal_case import (
    CaseAlreadyExistsError,
    CaseLockedError,
    appeal_case,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseParticipantRepository,
)
from tests.fixtures.database import SaveFixture


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


async def _participants(
    session: AsyncSession, case_id: object
) -> list[SupportCaseParticipant]:
    repository = SupportCaseParticipantRepository.from_session(session)
    statement = repository.get_base_statement().where(
        SupportCaseParticipant.case_id == case_id
    )
    return list(await repository.get_all(statement))


@pytest.mark.asyncio
class TestRequestHumanReview:
    async def test_creates_linked_case(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        user: User,
    ) -> None:
        case = await appeal_case.request_human_review(
            session,
            denied_review,
            reason="Please reconsider — here is the missing context.",
            requested_by_user_id=user.id,
        )

        assert case.type == SupportCaseType.review_appeal
        assert case.organization_review_id == denied_review.id

        participants = await _participants(session, case.id)
        assert len(participants) == 1
        assert participants[0].kind == SupportCaseParticipantKind.merchant
        assert participants[0].organization_id == denied_review.organization_id
        assert participants[0].platform_user_id is None

        message_repository = SupportCaseMessageRepository.from_session(session)
        messages = await message_repository.list_by_case(case.id)
        types = {m.type for m in messages}
        assert SupportCaseMessageType.opened in types
        chat = [m for m in messages if m.type == SupportCaseMessageType.chat]
        assert len(chat) == 1
        assert chat[0].body == "Please reconsider — here is the missing context."
        assert chat[0].author_kind == SupportCaseMessageAuthorKind.merchant

        assert await message_repository.is_open(case.id) is True

    async def test_duplicate_raises(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        user: User,
    ) -> None:
        await appeal_case.request_human_review(
            session, denied_review, reason="first", requested_by_user_id=user.id
        )
        with pytest.raises(CaseAlreadyExistsError):
            await appeal_case.request_human_review(
                session, denied_review, reason="second", requested_by_user_id=user.id
            )


@pytest.mark.asyncio
class TestReplyAndLock:
    async def test_locked_after_final_decision(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        user: User,
    ) -> None:
        case = await appeal_case.request_human_review(
            session, denied_review, reason="reason", requested_by_user_id=user.id
        )

        await appeal_case.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user_id=user.id,
            body="some more info",
        )

        await appeal_case.record_decision(
            session, case, approved=False, staff_user_id=user.id, reason="denied again"
        )

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False

        with pytest.raises(CaseLockedError):
            await appeal_case.add_reply(
                session,
                case,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                author_user_id=user.id,
                body="please reconsider again",
            )


@pytest.mark.asyncio
class TestThreadAudience:
    async def test_internal_note_hidden_from_merchant(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        user: User,
    ) -> None:
        case = await appeal_case.request_human_review(
            session, denied_review, reason="reason", requested_by_user_id=user.id
        )
        await appeal_case.add_reply(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user_id=user.id,
            body="internal staff note",
            internal=True,
        )

        merchant_thread = await appeal_case.get_thread(
            session, denied_review, visible_to=SupportCaseAudience.merchant
        )
        assert merchant_thread is not None
        _case, _is_open, merchant_messages = merchant_thread
        assert "internal staff note" not in [m.body for m in merchant_messages]

        full_thread = await appeal_case.get_thread(
            session, denied_review, visible_to=None
        )
        assert full_thread is not None
        _c, _o, all_messages = full_thread
        assert "internal staff note" in [m.body for m in all_messages]
