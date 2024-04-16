import uuid

import pytest
from arq import Retry
from pytest_mock import MockerFixture

from polar.benefit.benefits import BenefitRetriableError
from polar.benefit.service.benefit_grant import (
    BenefitGrantService,
)
from polar.benefit.tasks import (  # type: ignore[attr-defined]
    BenefitDoesNotExist,
    BenefitGrantDoesNotExist,
    UserDoesNotExist,
    benefit_delete,
    benefit_grant,
    benefit_grant_service,
    benefit_precondition_fulfilled,
    benefit_revoke,
    benefit_update,
)
from polar.models import Benefit, BenefitGrant, Subscription, User
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.worker import JobContext, PolarWorkerContext
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestBenefitGrant:
    async def test_not_existing_user(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UserDoesNotExist):
            await benefit_grant(
                job_context,
                uuid.uuid4(),
                benefit_organization.id,
                polar_worker_context,
                subscription_id=subscription.id,
            )

    async def test_not_existing_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitDoesNotExist):
            await benefit_grant(
                job_context,
                user.id,
                uuid.uuid4(),
                polar_worker_context,
                subscription_id=subscription.id,
            )

    async def test_existing_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        grant_benefit_mock = mocker.patch.object(
            benefit_grant_service,
            "grant_benefit",
            spec=BenefitGrantService.grant_benefit,
        )

        # then
        session.expunge_all()

        await benefit_grant(
            job_context,
            user.id,
            benefit_organization.id,
            polar_worker_context,
            subscription_id=subscription.id,
        )

        grant_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        grant_benefit_mock = mocker.patch.object(
            benefit_grant_service,
            "grant_benefit",
            spec=BenefitGrantService.grant_benefit,
        )
        grant_benefit_mock.side_effect = BenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await benefit_grant(
                job_context,
                user.id,
                benefit_organization.id,
                polar_worker_context,
                subscription_id=subscription.id,
            )


@pytest.mark.asyncio
class TestBenefitRevoke:
    async def test_not_existing_user(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UserDoesNotExist):
            await benefit_revoke(
                job_context,
                uuid.uuid4(),
                benefit_organization.id,
                polar_worker_context,
                subscription_id=subscription.id,
            )

    async def test_not_existing_benefit(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitDoesNotExist):
            await benefit_revoke(
                job_context,
                user.id,
                uuid.uuid4(),
                polar_worker_context,
                subscription_id=subscription.id,
            )

    async def test_existing_benefit(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        revoke_benefit_mock = mocker.patch.object(
            benefit_grant_service,
            "revoke_benefit",
            spec=BenefitGrantService.revoke_benefit,
        )

        # then
        session.expunge_all()

        await benefit_revoke(
            job_context,
            user.id,
            benefit_organization.id,
            polar_worker_context,
            subscription_id=subscription.id,
        )

        revoke_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        revoke_benefit_mock = mocker.patch.object(
            benefit_grant_service,
            "revoke_benefit",
            spec=BenefitGrantService.revoke_benefit,
        )
        revoke_benefit_mock.side_effect = BenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await benefit_revoke(
                job_context,
                user.id,
                benefit_organization.id,
                polar_worker_context,
                subscription_id=subscription.id,
            )


@pytest.mark.asyncio
class TestBenefitUpdate:
    async def test_not_existing_grant(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitGrantDoesNotExist):
            await benefit_update(job_context, uuid.uuid4(), polar_worker_context)

    async def test_existing_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        update_benefit_grant_mock = mocker.patch.object(
            benefit_grant_service,
            "update_benefit_grant",
            spec=BenefitGrantService.update_benefit_grant,
        )

        # then
        session.expunge_all()

        await benefit_update(job_context, grant.id, polar_worker_context)

        update_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        update_benefit_grant_mock = mocker.patch.object(
            benefit_grant_service,
            "update_benefit_grant",
            spec=BenefitGrantService.update_benefit_grant,
        )
        update_benefit_grant_mock.side_effect = BenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await benefit_update(job_context, grant.id, polar_worker_context)


@pytest.mark.asyncio
class TestBenefitDelete:
    async def test_not_existing_grant(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitGrantDoesNotExist):
            await benefit_delete(job_context, uuid.uuid4(), polar_worker_context)

    async def test_existing_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        delete_benefit_grant_mock = mocker.patch.object(
            benefit_grant_service,
            "delete_benefit_grant",
            spec=BenefitGrantService.delete_benefit_grant,
        )

        # then
        session.expunge_all()

        await benefit_delete(job_context, grant.id, polar_worker_context)

        delete_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        subscription: Subscription,
        user: User,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, user=user, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        delete_benefit_grant_mock = mocker.patch.object(
            benefit_grant_service,
            "delete_benefit_grant",
            spec=BenefitGrantService.delete_benefit_grant,
        )
        delete_benefit_grant_mock.side_effect = BenefitRetriableError(10)

        # then
        session.expunge_all()

        with pytest.raises(Retry):
            await benefit_delete(job_context, grant.id, polar_worker_context)


@pytest.mark.asyncio
class TestBenefitPreconditionFulfilled:
    async def test_not_existing_user(
        self,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(UserDoesNotExist):
            await benefit_precondition_fulfilled(
                job_context,
                uuid.uuid4(),
                BenefitType.custom,
                polar_worker_context,
            )

    async def test_existing_user(
        self,
        mocker: MockerFixture,
        job_context: JobContext,
        polar_worker_context: PolarWorkerContext,
        session: AsyncSession,
        user: User,
    ) -> None:
        enqueue_grants_after_precondition_fulfilled_mock = mocker.patch.object(
            benefit_grant_service,
            "enqueue_grants_after_precondition_fulfilled",
            spec=BenefitGrantService.enqueue_grants_after_precondition_fulfilled,
        )

        # then
        session.expunge_all()

        await benefit_precondition_fulfilled(
            job_context, user.id, BenefitType.custom, polar_worker_context
        )

        enqueue_grants_after_precondition_fulfilled_mock.assert_called_once()
