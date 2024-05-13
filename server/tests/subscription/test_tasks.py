import uuid

import pytest
from pytest_mock import MockerFixture

from polar.models import Product, Subscription
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import SubscriptionService
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionDoesNotExist,
    SubscriptionTierDoesNotExist,
    subscription_enqueue_benefits_grants,
    subscription_service,
    subscription_update_subscription_tier_benefits_grants,
)
from polar.worker import JobContext, PolarWorkerContext


@pytest.mark.asyncio
class TestSubscriptionEnqueueBenefitsGrants:
    async def test_not_existing_subscription(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_enqueue_benefits_grants(
                job_context, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_subscription(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        session: AsyncSession,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "enqueue_benefits_grants",
            spec=SubscriptionService.enqueue_benefits_grants,
        )

        # then
        session.expunge_all()

        await subscription_enqueue_benefits_grants(
            job_context, subscription.id, polar_worker_context
        )

        enqueue_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionUpdateSubscriptionTierBenefitsGrants:
    async def test_not_existing_subscription_tier(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_update_subscription_tier_benefits_grants(
                job_context, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_subscription_tier(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_tier: Product,
        session: AsyncSession,
    ) -> None:
        update_subscription_tier_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "update_subscription_tier_benefits_grants",
            spec=SubscriptionService.update_subscription_tier_benefits_grants,
        )

        # then
        session.expunge_all()

        await subscription_update_subscription_tier_benefits_grants(
            job_context, subscription_tier.id, polar_worker_context
        )

        update_subscription_tier_benefits_grants_mock.assert_called_once()
