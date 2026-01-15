import uuid

import pytest
from dramatiq import Retry
from pytest_mock import MockerFixture

from polar.benefit.grant.service import BenefitGrantService
from polar.benefit.strategies import BenefitRetriableError
from polar.benefit.tasks import (
    BenefitDoesNotExist,
    BenefitGrantDoesNotExist,
    CustomerDoesNotExist,
    benefit_delete,
    benefit_delete_grant,
    benefit_grant,
    benefit_grant_service,
    benefit_revoke,
    benefit_update,
)
from polar.models import Benefit, BenefitGrant, Customer, Subscription
from polar.postgres import AsyncSession
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
