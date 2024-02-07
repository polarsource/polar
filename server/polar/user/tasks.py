import uuid

from polar.config import settings
from polar.exceptions import PolarError
from polar.subscription.service.subscription import subscription as subscription_service
from polar.subscription.service.subscription_tier import (
    subscription_tier as subscription_tier_service,
)
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import user as user_service


class UserTaskError(PolarError):
    ...


class UserDoesNotExist(UserTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message, 500)


@task("user.on_after_signup")
async def user_on_after_signup(
    ctx: JobContext,
    user_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)

        if user is None:
            raise UserDoesNotExist(user_id)

        if settings.AUTO_SUBSCRIBE_SUBSCRIPTION_TIER_ID is not None:
            auto_subscribe_subscription_tier = await subscription_tier_service.get(
                session, settings.AUTO_SUBSCRIBE_SUBSCRIPTION_TIER_ID
            )
            if auto_subscribe_subscription_tier is not None:
                await subscription_service.create_arbitrary_subscription(
                    session,
                    user=user,
                    subscription_tier=auto_subscribe_subscription_tier,
                )
