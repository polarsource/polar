from datetime import timedelta

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Feedback, User
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .repository import FeedbackRepository
from .schemas import FeedbackCreate

RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW = timedelta(hours=1)


class FeedbackError(PolarError): ...


class FeedbackRateLimitExceeded(FeedbackError):
    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(
            "You've sent a lot of feedback recently. Please try again later.",
            status_code=429,
            headers={"Retry-After": str(retry_after_seconds)},
        )


class FeedbackService:
    async def submit(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        create_schema: FeedbackCreate,
    ) -> Feedback:
        user = auth_subject.subject

        membership = await user_organization_service.get_by_user_and_org(
            session, user.id, create_schema.organization_id
        )
        if membership is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "organization_id"),
                        "msg": "User is not a member of this organization.",
                        "input": create_schema.organization_id,
                    }
                ]
            )

        await self._enforce_rate_limit(session, user=user)

        repository = FeedbackRepository.from_session(session)
        return await repository.create(
            Feedback(
                type=create_schema.type,
                message=create_schema.message,
                client_context=create_schema.client_context,
                user_id=user.id,
                organization_id=create_schema.organization_id,
            )
        )

    async def _enforce_rate_limit(
        self, session: AsyncSession, *, user: User
    ) -> None:
        repository = FeedbackRepository.from_session(session)
        since = utc_now() - RATE_LIMIT_WINDOW
        count = await repository.count_recent_by_user(user.id, since=since)
        if count >= RATE_LIMIT_MAX:
            raise FeedbackRateLimitExceeded(
                retry_after_seconds=int(RATE_LIMIT_WINDOW.total_seconds())
            )


feedback = FeedbackService()
