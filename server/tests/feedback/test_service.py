from datetime import timedelta

import pytest

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError
from polar.feedback.schemas import FeedbackCreate
from polar.feedback.service import (
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
    FeedbackRateLimitExceeded,
)
from polar.feedback.service import feedback as feedback_service
from polar.kit.utils import utc_now
from polar.models import Feedback, Organization, User, UserOrganization
from polar.models.feedback import FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user


def _build_payload(
    organization: Organization,
    *,
    type: FeedbackType = FeedbackType.bug,
    message: str = "Something is broken in the dashboard.",
) -> FeedbackCreate:
    return FeedbackCreate(
        type=type,
        message=message,
        organization_id=organization.id,
        client_context={"url": "https://polar.sh/dashboard"},
    )


@pytest.mark.asyncio
class TestSubmit:
    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_member_can_submit(
        self,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        feedback = await feedback_service.submit(
            session, auth_subject, _build_payload(organization)
        )

        assert feedback.id is not None
        assert feedback.user_id == auth_subject.subject.id
        assert feedback.organization_id == organization.id
        assert feedback.type == FeedbackType.bug
        assert feedback.client_context == {"url": "https://polar.sh/dashboard"}

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_non_member_is_rejected(
        self,
        session: AsyncSession,
        organization: Organization,
        auth_subject: AuthSubject[User],
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await feedback_service.submit(
                session, auth_subject, _build_payload(organization)
            )

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_rate_limit_after_max(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        for _ in range(RATE_LIMIT_MAX):
            await save_fixture(
                Feedback(
                    type=FeedbackType.feedback,
                    message="prior submission",
                    client_context={},
                    user_id=auth_subject.subject.id,
                    organization_id=organization.id,
                )
            )

        with pytest.raises(FeedbackRateLimitExceeded) as exc_info:
            await feedback_service.submit(
                session, auth_subject, _build_payload(organization)
            )
        # Submissions are fresh, so retry_after is close to the full window.
        window_seconds = int(RATE_LIMIT_WINDOW.total_seconds())
        assert window_seconds - 60 <= exc_info.value.retry_after_seconds <= window_seconds

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_rate_limit_retry_after_tracks_oldest(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        # Oldest submission is 50 minutes old, so retry_after should be ~10 minutes.
        oldest_age = timedelta(minutes=50)
        await save_fixture(
            Feedback(
                type=FeedbackType.feedback,
                message="oldest in window",
                client_context={},
                user_id=auth_subject.subject.id,
                organization_id=organization.id,
                created_at=utc_now() - oldest_age,
            )
        )
        for _ in range(RATE_LIMIT_MAX - 1):
            await save_fixture(
                Feedback(
                    type=FeedbackType.feedback,
                    message="prior submission",
                    client_context={},
                    user_id=auth_subject.subject.id,
                    organization_id=organization.id,
                )
            )

        with pytest.raises(FeedbackRateLimitExceeded) as exc_info:
            await feedback_service.submit(
                session, auth_subject, _build_payload(organization)
            )
        expected = int((RATE_LIMIT_WINDOW - oldest_age).total_seconds())
        assert abs(exc_info.value.retry_after_seconds - expected) <= 5

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_rate_limit_resets_after_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        outside_window = utc_now() - RATE_LIMIT_WINDOW - timedelta(minutes=5)
        for _ in range(RATE_LIMIT_MAX):
            await save_fixture(
                Feedback(
                    type=FeedbackType.feedback,
                    message="old submission",
                    client_context={},
                    user_id=auth_subject.subject.id,
                    organization_id=organization.id,
                    created_at=outside_window,
                )
            )

        feedback = await feedback_service.submit(
            session, auth_subject, _build_payload(organization)
        )
        assert feedback.id is not None

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_rate_limit_is_per_user(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        other_user = await create_user(save_fixture)
        for _ in range(RATE_LIMIT_MAX):
            await save_fixture(
                Feedback(
                    type=FeedbackType.feedback,
                    message="other user submission",
                    client_context={},
                    user_id=other_user.id,
                    organization_id=organization.id,
                )
            )

        feedback = await feedback_service.submit(
            session, auth_subject, _build_payload(organization)
        )
        assert feedback.id is not None
