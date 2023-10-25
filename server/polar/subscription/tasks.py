import uuid

from polar.exceptions import PolarError
from polar.worker import AsyncSessionMaker, JobContext, task

from .service.subscription import subscription as subscription_service
from .service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from .service.subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)


class SubscriptionTaskError(PolarError):
    ...


class SubscriptionDoesNotExist(PolarError):
    def __init__(self, subscription_id: uuid.UUID) -> None:
        self.subscription_id = subscription_id
        message = f"The susbcription with id {subscription_id} does not exist."
        super().__init__(message, 500)


class SubscriptionBenefitDoesNotExist(PolarError):
    def __init__(self, subscription_benefit_id: uuid.UUID) -> None:
        self.subscription_benefit_id = subscription_benefit_id
        message = (
            f"The susbcription benefit with id {subscription_benefit_id} "
            "does not exist."
        )
        super().__init__(message, 500)


@task("subscription.subscription.enqueue_benefits_grants")
async def enqueue_benefits_grants(ctx: JobContext, subscription_id: uuid.UUID) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        await subscription_service.enqueue_benefits_grants(session, subscription)


@task("subscription.subscription_benefit.grant")
async def subscription_benefit_grant(
    ctx: JobContext, subscription_id: uuid.UUID, subscription_benefit_id: uuid.UUID
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        subscription_benefit = await subscription_benefit_service.get(
            session, subscription_benefit_id
        )
        if subscription_benefit is None:
            raise SubscriptionBenefitDoesNotExist(subscription_benefit_id)

        await subscription_benefit_grant_service.grant_benefit(
            session, subscription, subscription_benefit
        )


@task("subscription.subscription_benefit.revoke")
async def subscription_benefit_revoke(
    ctx: JobContext, subscription_id: uuid.UUID, subscription_benefit_id: uuid.UUID
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        subscription_benefit = await subscription_benefit_service.get(
            session, subscription_benefit_id
        )
        if subscription_benefit is None:
            raise SubscriptionBenefitDoesNotExist(subscription_benefit_id)

        await subscription_benefit_grant_service.revoke_benefit(
            session, subscription, subscription_benefit
        )
