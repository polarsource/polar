import pytest

from polar.feedback.repository import FeedbackRepository
from polar.kit.utils import utc_now
from polar.models import Feedback, Organization, User
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def _create_feedback(
    save_fixture: SaveFixture,
    user: User,
    organization: Organization,
    *,
    type: FeedbackType,
    status: FeedbackStatus = FeedbackStatus.new,
    deleted: bool = False,
) -> Feedback:
    feedback = Feedback(
        type=type,
        status=status,
        message="A sufficiently long feedback message for testing.",
        client_context={},
        user=user,
        organization=organization,
    )
    if deleted:
        feedback.deleted_at = utc_now()
    await save_fixture(feedback)
    return feedback


@pytest.mark.asyncio
class TestGetTypeCounts:
    async def test_counts_grouped_by_type_for_status(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        await _create_feedback(save_fixture, user, organization, type=FeedbackType.bug)
        await _create_feedback(save_fixture, user, organization, type=FeedbackType.bug)
        await _create_feedback(
            save_fixture, user, organization, type=FeedbackType.question
        )
        # Different status — must not be counted for `new`.
        await _create_feedback(
            save_fixture,
            user,
            organization,
            type=FeedbackType.feedback,
            status=FeedbackStatus.triaged,
        )

        repository = FeedbackRepository.from_session(session)
        counts = await repository.get_type_counts(FeedbackStatus.new)

        assert counts == {FeedbackType.bug: 2, FeedbackType.question: 1}

    async def test_excludes_soft_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
    ) -> None:
        await _create_feedback(save_fixture, user, organization, type=FeedbackType.bug)
        await _create_feedback(
            save_fixture, user, organization, type=FeedbackType.bug, deleted=True
        )

        repository = FeedbackRepository.from_session(session)
        counts = await repository.get_type_counts(FeedbackStatus.new)

        assert counts == {FeedbackType.bug: 1}

    async def test_empty_when_no_feedback(
        self,
        session: AsyncSession,
    ) -> None:
        repository = FeedbackRepository.from_session(session)
        counts = await repository.get_type_counts(FeedbackStatus.new)

        assert counts == {}
