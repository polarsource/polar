import uuid

import pytest
from dramatiq import Retry
from pytest_mock import MockerFixture

from polar.benefit.grant.service import BenefitGrantService
from polar.benefit.strategies import BenefitRetriableError
from polar.benefit.tasks import (  # type: ignore[attr-defined]
    BenefitDoesNotExist,
    BenefitGrantDoesNotExist,
    CustomerDoesNotExist,
    benefit_delete,
    benefit_delete_grant,
    benefit_enqueue_grants,
    benefit_grant,
    benefit_grant_service,
    benefit_revoke,
    benefit_update,
)
from polar.models import Benefit, BenefitGrant, Customer, Subscription
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionService
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestBenefitGrant:
    async def test_not_existing_customer(
        self,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(CustomerDoesNotExist):
            await benefit_grant(
                uuid.uuid4(),
                benefit_organization.id,
                subscription_id=subscription.id,
            )

    async def test_not_existing_benefit(
        self,
        subscription: Subscription,
        customer: Customer,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitDoesNotExist):
            await benefit_grant(
                customer.id, uuid.uuid4(), subscription_id=subscription.id
            )

    async def test_existing_benefit(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
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
            customer.id,
            benefit_organization.id,
            subscription_id=subscription.id,
        )

        grant_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
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
                customer.id,
                benefit_organization.id,
                subscription_id=subscription.id,
            )


@pytest.mark.asyncio
class TestBenefitRevoke:
    async def test_not_existing_customer(
        self,
        subscription: Subscription,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(CustomerDoesNotExist):
            await benefit_revoke(
                uuid.uuid4(),
                benefit_organization.id,
                subscription_id=subscription.id,
            )

    async def test_not_existing_benefit(
        self,
        subscription: Subscription,
        customer: Customer,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitDoesNotExist):
            await benefit_revoke(
                customer.id, uuid.uuid4(), subscription_id=subscription.id
            )

    async def test_existing_benefit(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
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
            customer.id,
            benefit_organization.id,
            subscription_id=subscription.id,
        )

        revoke_benefit_mock.assert_called_once()

    async def test_retry(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
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
                customer.id,
                benefit_organization.id,
                subscription_id=subscription.id,
            )


@pytest.mark.asyncio
class TestBenefitUpdate:
    async def test_not_existing_grant(
        self,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitGrantDoesNotExist):
            await benefit_update(uuid.uuid4())

    async def test_existing_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
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

        await benefit_update(grant.id)

        update_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
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
            await benefit_update(grant.id)


@pytest.mark.asyncio
class TestBenefitDelete:
    async def test_soft_deleted_benefit(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        benefit_organization.set_deleted_at()
        await save_fixture(benefit_organization)

        await benefit_delete(benefit_organization.id)

        enqueue_job_mock.assert_called_once()


@pytest.mark.asyncio
class TestBenefitDeleteGrant:
    async def test_not_existing_grant(
        self,
        benefit_organization: Benefit,
        session: AsyncSession,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(BenefitGrantDoesNotExist):
            await benefit_delete_grant(uuid.uuid4())

    async def test_existing_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
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

        await benefit_delete_grant(grant.id)

        delete_benefit_grant_mock.assert_called_once()

    async def test_retry(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
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
            await benefit_delete_grant(grant.id)


@pytest.mark.asyncio
class TestBenefitEnqueueGrants:
    async def test_resets_meters_for_subscription(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        session: AsyncSession,
    ) -> None:
        reset_meters_mock = mocker.patch.object(
            subscription_service,
            "reset_meters",
            spec=SubscriptionService.reset_meters,
        )

        session.expunge_all()

        await benefit_enqueue_grants(
            subscription.customer_id, [], subscription_id=subscription.id
        )

        reset_meters_mock.assert_called_once()

    async def test_skips_meter_reset_without_subscription(
        self,
        mocker: MockerFixture,
        customer: Customer,
        session: AsyncSession,
    ) -> None:
        reset_meters_mock = mocker.patch.object(
            subscription_service,
            "reset_meters",
            spec=SubscriptionService.reset_meters,
        )

        session.expunge_all()

        await benefit_enqueue_grants(customer.id, [], order_id=uuid.uuid4())

        reset_meters_mock.assert_not_called()

    async def test_enqueues_grants(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        session: AsyncSession,
    ) -> None:
        mocker.patch.object(
            subscription_service,
            "reset_meters",
            spec=SubscriptionService.reset_meters,
        )
        enqueue_job_mock = mocker.patch("polar.benefit.tasks.enqueue_job")

        benefit_ids = [benefit_organization.id, benefit_organization_second.id]

        session.expunge_all()

        await benefit_enqueue_grants(
            subscription.customer_id,
            benefit_ids,
            subscription_id=subscription.id,
        )

        assert enqueue_job_mock.call_count == 2
        enqueue_job_mock.assert_any_call(
            "benefit.grant",
            customer_id=subscription.customer_id,
            benefit_id=benefit_organization.id,
            member_id=None,
            subscription_id=subscription.id,
        )
        enqueue_job_mock.assert_any_call(
            "benefit.grant",
            customer_id=subscription.customer_id,
            benefit_id=benefit_organization_second.id,
            member_id=None,
            subscription_id=subscription.id,
        )

    async def test_no_grants_skips_enqueue(
        self,
        mocker: MockerFixture,
        subscription: Subscription,
        session: AsyncSession,
    ) -> None:
        mocker.patch.object(
            subscription_service,
            "reset_meters",
            spec=SubscriptionService.reset_meters,
        )
        enqueue_job_mock = mocker.patch("polar.benefit.tasks.enqueue_job")

        session.expunge_all()

        await benefit_enqueue_grants(
            subscription.customer_id,
            [],
            subscription_id=subscription.id,
        )

        enqueue_job_mock.assert_not_called()
