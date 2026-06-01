import pytest
from pytest_mock import MockerFixture

from polar.feedback.repository import FeedbackRepository
from polar.feedback.tasks import feedback_reply_in_plain
from polar.models import Feedback, Organization, User
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def _create_question(
    save_fixture: SaveFixture,
    user: User,
    organization: Organization,
) -> Feedback:
    feedback = Feedback(
        type=FeedbackType.question,
        message="## Transcript\n\n**User**\n\nHow do I cancel?",
        client_context={},
        user=user,
        organization=organization,
    )
    await save_fixture(feedback)
    return feedback


@pytest.mark.asyncio
class TestFeedbackReplyInPlain:
    async def test_marks_as_triaged_on_success(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
    ) -> None:
        feedback = await _create_question(save_fixture, user, organization)
        mocker.patch("polar.feedback.tasks.plain_service.enabled", new=True)
        create_thread_mock = mocker.patch(
            "polar.feedback.tasks.plain_service.create_feedback_thread",
            return_value="https://app.plain.com/workspace/w/thread/th_123",
        )

        await feedback_reply_in_plain(feedback.id)

        create_thread_mock.assert_called_once()

        repository = FeedbackRepository.from_session(session)
        updated = await repository.get_by_id(feedback.id)
        assert updated is not None
        assert updated.status == FeedbackStatus.triaged
        assert (
            updated.support_thread_url
            == "https://app.plain.com/workspace/w/thread/th_123"
        )

    async def test_skips_when_thread_already_exists(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
    ) -> None:
        feedback = await _create_question(save_fixture, user, organization)
        feedback.support_thread_url = "https://app.plain.com/workspace/w/thread/th_old"
        await save_fixture(feedback)

        mocker.patch("polar.feedback.tasks.plain_service.enabled", new=True)
        create_thread_mock = mocker.patch(
            "polar.feedback.tasks.plain_service.create_feedback_thread",
        )

        await feedback_reply_in_plain(feedback.id)

        create_thread_mock.assert_not_called()

        repository = FeedbackRepository.from_session(session)
        updated = await repository.get_by_id(feedback.id)
        assert updated is not None
        assert updated.status == FeedbackStatus.new
