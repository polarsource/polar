import uuid

import structlog
from arq import Retry
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.money import get_cents_in_dollar_string
from polar.logging import Logger
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.organization.service import organization as organization_service
from polar.user.service import user as user_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service.benefits import SubscriptionBenefitRetriableError
from .service.subscription import subscription as subscription_service
from .service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from .service.subscription_benefit_grant import (
    subscription_benefit_grant as subscription_benefit_grant_service,
)
from .service.subscription_tier import subscription_tier as subscription_tier_service
from .service.subscription_tier_price import (
    subscription_tier_price as subscription_tier_price_service,
)

log: Logger = structlog.get_logger()


class SubscriptionTaskError(PolarError):
    ...


class SubscriptionDoesNotExist(SubscriptionTaskError):
    def __init__(self, subscription_id: uuid.UUID) -> None:
        self.subscription_id = subscription_id
        message = f"The subscription with id {subscription_id} does not exist."
        super().__init__(message, 500)


class SubscriptionTierDoesNotExist(SubscriptionTaskError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = (
            f"The subscription tier with id {subscription_tier_id} does not exist."
        )
        super().__init__(message, 500)


class UserDoesNotExist(SubscriptionTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message, 500)


class SubscriptionBenefitDoesNotExist(SubscriptionTaskError):
    def __init__(self, subscription_benefit_id: uuid.UUID) -> None:
        self.subscription_benefit_id = subscription_benefit_id
        message = (
            f"The subscription benefit with id {subscription_benefit_id} "
            "does not exist."
        )
        super().__init__(message, 500)


class SubscriptionBenefitGrantDoesNotExist(SubscriptionTaskError):
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


@task("subscription.subscription.update_subscription_tier_benefits_grants")
async def subscription_update_subscription_tier_benefits_grants(
    ctx: JobContext, subscription_tier_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription_tier = await subscription_tier_service.get(
            session, subscription_tier_id
        )
        if subscription_tier is None:
            raise SubscriptionTierDoesNotExist(subscription_tier_id)

        await subscription_service.update_subscription_tier_benefits_grants(
            session, subscription_tier
        )


@task("subscription.subscription_benefit.grant")
async def subscription_benefit_grant(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    user_id: uuid.UUID,
    subscription_benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        subscription_benefit = await subscription_benefit_service.get(
            session, subscription_benefit_id
        )
        if subscription_benefit is None:
            raise SubscriptionBenefitDoesNotExist(subscription_benefit_id)

        try:
            await subscription_benefit_grant_service.grant_benefit(
                session,
                subscription,
                user,
                subscription_benefit,
                attempt=ctx["job_try"],
            )
        except SubscriptionBenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while granting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                subscription_benefit_id=str(subscription_benefit_id),
                user_id=str(user_id),
            )
            raise Retry(e.defer_seconds) from e


@task("subscription.subscription_benefit.revoke")
async def subscription_benefit_revoke(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    user_id: uuid.UUID,
    subscription_benefit_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        subscription_benefit = await subscription_benefit_service.get(
            session, subscription_benefit_id
        )
        if subscription_benefit is None:
            raise SubscriptionBenefitDoesNotExist(subscription_benefit_id)

        try:
            await subscription_benefit_grant_service.revoke_benefit(
                session,
                subscription,
                user,
                subscription_benefit,
                attempt=ctx["job_try"],
            )
        except SubscriptionBenefitRetriableError as e:
            log.warning(
                "Retriable error encountered while revoking benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                subscription_benefit_id=str(subscription_benefit_id),
                user_id=str(user_id),
            )
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
            log.warning(
                "Retriable error encountered while updating benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                subscription_benefit_grant_id=str(subscription_benefit_grant_id),
            )
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
            log.warning(
                "Retriable error encountered while deleting benefit",
                error=str(e),
                defer_seconds=e.defer_seconds,
                subscription_benefit_grant_id=str(subscription_benefit_grant_id),
            )
            raise Retry(e.defer_seconds) from e


@task("subscription.subscription_benefit.precondition_fulfilled")
async def subscription_benefit_precondition_fulfilled(
    ctx: JobContext,
    user_id: uuid.UUID,
    subscription_benefit_type: SubscriptionBenefitType,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        user = await user_service.get(session, user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        await subscription_benefit_grant_service.enqueue_grants_after_precondition_fulfilled(
            session, user, subscription_benefit_type
        )


@task("subscription.discord_notification")
async def subscription_discord_notification(
    ctx: JobContext,
    subscription_id: uuid.UUID,
    polar_context: PolarWorkerContext,
) -> None:
    if not settings.DISCORD_WEBHOOK_URL:
        return

    async with AsyncSessionMaker(ctx) as session:
        subscription = await subscription_service.get(session, subscription_id)
        if subscription is None:
            raise SubscriptionDoesNotExist(subscription_id)

        assert subscription.price_id is not None
        price = await subscription_tier_price_service.get(
            session, subscription.price_id
        )
        assert price is not None

        tier = await subscription_tier_service.get(
            session, subscription.subscription_tier_id
        )
        if not tier:
            raise SubscriptionDoesNotExist(subscription_id)

        tier_org = await organization_service.get(
            session, tier.managing_organization_id
        )
        if not tier_org:
            raise SubscriptionDoesNotExist(subscription_id)

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL, content="New subscription"
        )

        embed = DiscordEmbed(
            title=tier.name,
            description=f"${get_cents_in_dollar_string(price.price_amount)}/{price.recurring_interval}",
            color="65280",
        )

        embed.add_embed_field(
            name="Org",
            value=f"[{tier_org.name}](https://polar.sh/{tier_org.name})",
        )

        webhook.add_embed(embed)
        await webhook.execute()
