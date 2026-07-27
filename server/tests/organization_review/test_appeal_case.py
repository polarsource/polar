import contextlib
from collections.abc import AsyncIterator
from unittest.mock import patch

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.models import OrganizationReview
from polar.models.organization import Organization
from polar.models.support_case import (
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
    SupportCaseType,
)
from polar.models.user import User
from polar.organization_review.appeal_case import (
    HUMAN_REVIEW_GREETING,
    HUMAN_REVIEW_GREETING_DELAY_MS,
    CaseAlreadyExistsError,
    CaseClosedError,
)
from polar.organization_review.appeal_case import (
    appeal_case as appeal_case_service,
)
from polar.organization_review.tasks import post_appeal_greeting
from polar.postgres import AsyncSession
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseParticipantRepository,
)
from polar.support_case.schemas import ReviewAppealSupportCaseMessageCreate
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization_review

_post_appeal_greeting = post_appeal_greeting.__wrapped__  # type: ignore[attr-defined]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


def _reply(body: str) -> ReviewAppealSupportCaseMessageCreate:
    return ReviewAppealSupportCaseMessageCreate(
        type=SupportCaseType.review_appeal, body=body
    )


@pytest_asyncio.fixture
async def denied_review(
    save_fixture: SaveFixture, organization: Organization
) -> OrganizationReview:
    return await create_organization_review(
        save_fixture,
        organization,
        appeal_decision=OrganizationReview.AppealDecision.REJECTED,
    )


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
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.organization_review.appeal_case.enqueue_job"
        )
        publish_mock = mocker.patch(
            "polar.organization_review.appeal_case.publish_appeal_update"
        )

        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="Please reconsider — here is the missing context.",
            requested_by_user=user,
            organization=organization,
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
        # Only the merchant's message is posted synchronously; the greeting is
        # enqueued as a delayed job so it lands a beat later.
        chat = [m for m in messages if m.type == SupportCaseMessageType.chat]
        assert len(chat) == 1
        assert chat[0].body == "Please reconsider — here is the missing context."
        assert chat[0].author_kind == SupportCaseMessageAuthorKind.merchant
        enqueue_job_mock.assert_called_once_with(
            "organization_review.post_appeal_greeting",
            case_id=case.id,
            delay=HUMAN_REVIEW_GREETING_DELAY_MS,
        )
        publish_mock.assert_called_once_with(organization.id)

        assert await message_repository.is_open(case.id) is True

    async def test_duplicate_raises(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="first",
            requested_by_user=user,
            organization=organization,
        )
        with pytest.raises(CaseAlreadyExistsError):
            await appeal_case_service.request_human_review(
                session,
                denied_review,
                reason="second",
                requested_by_user=user,
                organization=organization,
            )


@pytest.mark.asyncio
class TestReplyAndLock:
    async def test_locked_after_final_decision(
        self,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="reason",
            requested_by_user=user,
            organization=organization,
        )

        await appeal_case_service.add_reply(
            session,
            case,
            _reply("some more info"),
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user=user,
        )

        await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="denied again"
        )

        message_repository = SupportCaseMessageRepository.from_session(session)
        assert await message_repository.is_open(case.id) is False

        with pytest.raises(CaseClosedError):
            await appeal_case_service.add_reply(
                session,
                case,
                _reply("please reconsider again"),
                author_kind=SupportCaseMessageAuthorKind.merchant,
                author_user=user,
            )


@pytest.mark.asyncio
class TestReplyNotifiesMerchant:
    async def test_merchant_visible_reply_enqueues_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue = mocker.patch("polar.organization_review.appeal_case.enqueue_job")
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="reason",
            requested_by_user=user,
            organization=organization,
        )
        enqueue.reset_mock()
        publish = mocker.patch(
            "polar.organization_review.appeal_case.publish_appeal_update"
        )
        message = await appeal_case_service.add_reply(
            session,
            case,
            _reply("staff reply"),
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=user,
        )
        enqueue.assert_called_once_with(
            "support_case.notify_organization_of_new_message", message_id=message.id
        )
        publish.assert_called_once_with(case.organization_id)

    async def test_internal_note_does_not_enqueue(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue = mocker.patch("polar.organization_review.appeal_case.enqueue_job")
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="reason",
            requested_by_user=user,
            organization=organization,
        )
        enqueue.reset_mock()
        publish = mocker.patch(
            "polar.organization_review.appeal_case.publish_appeal_update"
        )
        await appeal_case_service.add_reply(
            session,
            case,
            _reply("internal staff note"),
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=user,
            internal=True,
        )
        enqueue.assert_not_called()
        publish.assert_not_called()

    async def test_decision_enqueues_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue = mocker.patch("polar.organization_review.appeal_case.enqueue_job")
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="reason",
            requested_by_user=user,
            organization=organization,
        )
        enqueue.reset_mock()
        publish = mocker.patch(
            "polar.organization_review.appeal_case.publish_appeal_update"
        )
        message = await appeal_case_service.record_decision(
            session, case, approved=False, staff_user=user, reason="denied again"
        )
        enqueue.assert_called_once_with(
            "support_case.notify_organization_of_new_message", message_id=message.id
        )
        publish.assert_called_once_with(case.organization_id)


@pytest.mark.asyncio
class TestPostAppealGreeting:
    async def test_posts_greeting(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        mocker.patch("polar.organization_review.appeal_case.enqueue_job")
        publish_mock = mocker.patch(
            "polar.organization_review.tasks.publish_appeal_update"
        )
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="Please reconsider.",
            requested_by_user=user,
            organization=organization,
        )

        with patch(
            "polar.organization_review.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        ):
            await _post_appeal_greeting(case.id)
        await session.flush()

        message_repository = SupportCaseMessageRepository.from_session(session)
        messages = await message_repository.list_by_case(case.id)
        platform = [
            message
            for message in messages
            if message.author_kind == SupportCaseMessageAuthorKind.platform
            and message.type == SupportCaseMessageType.chat
        ]
        assert len(platform) == 1
        assert platform[0].body == HUMAN_REVIEW_GREETING
        publish_mock.assert_called_once_with(case.organization_id)

    async def test_idempotent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        denied_review: OrganizationReview,
        organization: Organization,
        user: User,
    ) -> None:
        mocker.patch("polar.organization_review.appeal_case.enqueue_job")
        case = await appeal_case_service.request_human_review(
            session,
            denied_review,
            reason="Please reconsider.",
            requested_by_user=user,
            organization=organization,
        )

        with patch(
            "polar.organization_review.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        ):
            await _post_appeal_greeting(case.id)
            await _post_appeal_greeting(case.id)
        await session.flush()

        message_repository = SupportCaseMessageRepository.from_session(session)
        messages = await message_repository.list_by_case(case.id)
        platform = [
            message
            for message in messages
            if message.author_kind == SupportCaseMessageAuthorKind.platform
        ]
        assert len(platform) == 1
