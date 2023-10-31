import uuid

import pytest
from pytest_mock import MockerFixture

from polar.models import Subscription, SubscriptionBenefit
from polar.subscription.service.subscription import SubscriptionService
from polar.subscription.service.subscription_benefit_grant import (
    SubscriptionBenefitGrantService,
)
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionBenefitDoesNotExist,
    SubscriptionDoesNotExist,
    enqueue_benefits_grants,
    subscription_benefit_grant,
    subscription_benefit_grant_service,
    subscription_benefit_revoke,
    subscription_service,
)
from polar.worker import JobContext, PolarWorkerContext


@pytest.mark.asyncio
class TestEnqueueBenefitsGrants:
    async def test_not_existing_subscription(
        self, job_context: JobContext, polar_worker_context: PolarWorkerContext
    ) -> None:
        with pytest.raises(SubscriptionDoesNotExist):
            await enqueue_benefits_grants(
                job_context, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_subscription(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "enqueue_benefits_grants",
            spec=SubscriptionService.enqueue_benefits_grants,
        )

        await enqueue_benefits_grants(
            job_context, subscription.id, polar_worker_context
        )

        enqueue_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionBenefitGrant:
    async def test_not_existing_subscription(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_benefit_grant(
                job_context,
                uuid.uuid4(),
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_subscription_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
    ) -> None:
        with pytest.raises(SubscriptionBenefitDoesNotExist):
            await subscription_benefit_grant(
                job_context, subscription.id, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_subscription_and_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        grant_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "grant_benefit",
            spec=SubscriptionBenefitGrantService.grant_benefit,
        )

        await subscription_benefit_grant(
            job_context,
            subscription.id,
            subscription_benefit_organization.id,
            polar_worker_context,
        )

        grant_benefit_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionBenefitRevoke:
    async def test_not_existing_subscription(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_benefit_revoke(
                job_context,
                uuid.uuid4(),
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_subscription_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
    ) -> None:
        with pytest.raises(SubscriptionBenefitDoesNotExist):
            await subscription_benefit_revoke(
                job_context, subscription.id, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_subscription_and_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        revoke_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "revoke_benefit",
            spec=SubscriptionBenefitGrantService.revoke_benefit,
        )

        await subscription_benefit_revoke(
            job_context,
            subscription.id,
            subscription_benefit_organization.id,
            polar_worker_context,
        )

        revoke_benefit_mock.assert_called_once()
