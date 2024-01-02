import uuid

import pytest
from arq import Retry
from pytest_mock import MockerFixture

from polar.models import (
    Subscription,
    SubscriptionBenefit,
    SubscriptionBenefitGrant,
    SubscriptionTier,
    User,
)
from polar.postgres import AsyncSession
from polar.subscription.service.benefits import SubscriptionBenefitRetriableError
from polar.subscription.service.subscription import SubscriptionService
from polar.subscription.service.subscription_benefit_grant import (
    SubscriptionBenefitGrantService,
)
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionBenefitDoesNotExist,
    SubscriptionBenefitGrantDoesNotExist,
    SubscriptionDoesNotExist,
    SubscriptionTierDoesNotExist,
    UserDoesNotExist,
    subscription_benefit_delete,
    subscription_benefit_grant,
    subscription_benefit_grant_service,
    subscription_benefit_revoke,
    subscription_benefit_update,
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
        subscription_tier_organization: SubscriptionTier,
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
            job_context, subscription_tier_organization.id, polar_worker_context
        )

        update_subscription_tier_benefits_grants_mock.assert_called_once()


@pytest.mark.asyncio
class TestSubscriptionBenefitGrant:
    async def test_not_existing_subscription(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_benefit_grant(
                job_context,
                uuid.uuid4(),
                user.id,
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_user(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UserDoesNotExist):
            await subscription_benefit_grant(
                job_context,
                subscription.id,
                uuid.uuid4(),
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_subscription_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionBenefitDoesNotExist):
            await subscription_benefit_grant(
                job_context,
                subscription.id,
                user.id,
                uuid.uuid4(),
                polar_worker_context,
            )

    async def test_existing_subscription_and_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        grant_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "grant_benefit",
            spec=SubscriptionBenefitGrantService.grant_benefit,
        )

        # then
        session.expunge_all()

        await subscription_benefit_grant(
            job_context,
            subscription.id,
            user.id,
            subscription_benefit_organization.id,
            polar_worker_context,
        )

        grant_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        grant_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "grant_benefit",
            spec=SubscriptionBenefitGrantService.grant_benefit,
        )
        grant_benefit_mock.side_effect = SubscriptionBenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await subscription_benefit_grant(
                job_context,
                subscription.id,
                user.id,
                subscription_benefit_organization.id,
                polar_worker_context,
            )


@pytest.mark.asyncio
class TestSubscriptionBenefitRevoke:
    async def test_not_existing_subscription(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_benefit_revoke(
                job_context,
                uuid.uuid4(),
                user.id,
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_user(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UserDoesNotExist):
            await subscription_benefit_revoke(
                job_context,
                subscription.id,
                uuid.uuid4(),
                subscription_benefit_organization.id,
                polar_worker_context,
            )

    async def test_not_existing_subscription_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionBenefitDoesNotExist):
            await subscription_benefit_revoke(
                job_context,
                subscription.id,
                user.id,
                uuid.uuid4(),
                polar_worker_context,
            )

    async def test_existing_subscription_and_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        revoke_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "revoke_benefit",
            spec=SubscriptionBenefitGrantService.revoke_benefit,
        )

        # then
        session.expunge_all()

        await subscription_benefit_revoke(
            job_context,
            subscription.id,
            user.id,
            subscription_benefit_organization.id,
            polar_worker_context,
        )

        revoke_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        revoke_benefit_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "revoke_benefit",
            spec=SubscriptionBenefitGrantService.revoke_benefit,
        )
        revoke_benefit_mock.side_effect = SubscriptionBenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await subscription_benefit_revoke(
                job_context,
                subscription.id,
                user.id,
                subscription_benefit_organization.id,
                polar_worker_context,
            )


@pytest.mark.asyncio
class TestSubscriptionBenefitUpdate:
    async def test_not_existing_grant(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionBenefitGrantDoesNotExist):
            await subscription_benefit_update(
                job_context, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_grant(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            user=user,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        update_benefit_grant_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "update_benefit_grant",
            spec=SubscriptionBenefitGrantService.update_benefit_grant,
        )

        # then
        session.expunge_all()

        await subscription_benefit_update(job_context, grant.id, polar_worker_context)

        update_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            user=user,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        update_benefit_grant_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "update_benefit_grant",
            spec=SubscriptionBenefitGrantService.update_benefit_grant,
        )
        update_benefit_grant_mock.side_effect = SubscriptionBenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await subscription_benefit_update(
                job_context, grant.id, polar_worker_context
            )


@pytest.mark.asyncio
class TestSubscriptionBenefitDelete:
    async def test_not_existing_grant(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription_benefit_organization: SubscriptionBenefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionBenefitGrantDoesNotExist):
            await subscription_benefit_delete(
                job_context, uuid.uuid4(), polar_worker_context
            )

    async def test_existing_grant(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            user=user,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        delete_benefit_grant_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "delete_benefit_grant",
            spec=SubscriptionBenefitGrantService.delete_benefit_grant,
        )

        # then
        session.expunge_all()

        await subscription_benefit_delete(job_context, grant.id, polar_worker_context)

        delete_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        grant = SubscriptionBenefitGrant(
            subscription=subscription,
            user=user,
            subscription_benefit=subscription_benefit_organization,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        delete_benefit_grant_mock = mocker.patch.object(
            subscription_benefit_grant_service,
            "delete_benefit_grant",
            spec=SubscriptionBenefitGrantService.delete_benefit_grant,
        )
        delete_benefit_grant_mock.side_effect = SubscriptionBenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await subscription_benefit_delete(
                job_context, grant.id, polar_worker_context
            )
