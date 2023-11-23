import uuid

from arq import Retry

from polar.exceptions import PolarError
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service.benefits import SubscriptionBenefitRetriableError
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
        message = f"The subscription with id {subscription_id} does not exist."
        super().__init__(message, 500)


class SubscriptionBenefitDoesNotExist(PolarError):
    def __init__(self, subscription_benefit_id: uuid.UUID) -> None:
        self.subscription_benefit_id = subscription_benefit_id
        message = (
            f"The subscription benefit with id {subscription_benefit_id} "
            "does not exist."
        )
        super().__init__(message, 500)


class SubscriptionBenefitGrantDoesNotExist(PolarError):
    def __init__(self, subscription_benefit_grant_id: uuid.UUID) -> None:
        self.subscription_benefit_grant_id = subscription_benefit_grant_id
        message = (
            f"The subscription benefit grant with id {subscription_benefit_grant_id} "
            "does not exist."
        )
        super().__init__(message, 500)


@task("subscription.subscription.enqueue_benefits_grants")
async def subscription_enqueue_benefits_grants(
    ctx: JobContext, subscription_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        await subscription_service.enqueue_benefits_grants(session, subscription)


@task("subscription.subscription_benefit.grant")
async def subscription_benefit_grant(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    subscription_benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
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

        try:
            await subscription_benefit_grant_service.grant_benefit(
                session, subscription, subscription_benefit, attempt=ctx["job_try"]
            )
        except SubscriptionBenefitRetriableError as e:
            raise Retry(e.defer_seconds) from e


@task("subscription.subscription_benefit.revoke")
async def subscription_benefit_revoke(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    subscription_benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
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

        try:
            await subscription_benefit_grant_service.revoke_benefit(
                session, subscription, subscription_benefit, attempt=ctx["job_try"]
            )
        except SubscriptionBenefitRetriableError as e:
            raise Retry(e.defer_seconds) from e


@task("subscription.subscription_benefit.update")
async def subscription_benefit_update(
    ctx: JobContext,
    subscription_benefit_grant_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription_benefit_grant = await subscription_benefit_grant_service.get(
            session, subscription_benefit_grant_id
        )
        if subscription_benefit_grant is None:
            raise SubscriptionBenefitGrantDoesNotExist(subscription_benefit_grant_id)

        try:
            await subscription_benefit_grant_service.update_benefit_grant(
                session, subscription_benefit_grant, attempt=ctx["job_try"]
            )
        except SubscriptionBenefitRetriableError as e:
            raise Retry(e.defer_seconds) from e


@task("subscription.subscription_benefit.delete")
async def subscription_benefit_delete(
    ctx: JobContext,
    subscription_benefit_grant_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription_benefit_grant = await subscription_benefit_grant_service.get(
            session, subscription_benefit_grant_id
        )
        if subscription_benefit_grant is None:
            raise SubscriptionBenefitGrantDoesNotExist(subscription_benefit_grant_id)

        try:
            await subscription_benefit_grant_service.delete_benefit_grant(
                session, subscription_benefit_grant, attempt=ctx["job_try"]
            )
        except SubscriptionBenefitRetriableError as e:
            raise Retry(e.defer_seconds) from e
