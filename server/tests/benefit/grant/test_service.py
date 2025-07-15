from typing import Any, Literal, cast
from unittest.mock import MagicMock, call

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.strategies import BenefitActionRequiredError, BenefitServiceProtocol
from polar.models import Benefit, BenefitGrant, Customer, Product, Subscription
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit_grant,
    create_order,
    create_subscription,
    set_product_benefits,
)


@pytest.fixture(autouse=True)
def benefit_strategy_mock(mocker: MockerFixture) -> MagicMock:
    strategy_mock = MagicMock(spec=BenefitServiceProtocol)
    strategy_mock.should_revoke_individually = False
    strategy_mock.grant.return_value = {}
    strategy_mock.revoke.return_value = {}
    strategy_mock.cycle.return_value = {}
    mock = mocker.patch("polar.benefit.grant.service.get_benefit_strategy")
    mock.return_value = strategy_mock
    return strategy_mock


@pytest.mark.asyncio
class TestGrantBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.return_value = {"external_id": "abc"}

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.customer == customer
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_granted
        assert cast(Any, grant.properties) == {"external_id": "abc"}
        benefit_strategy_mock.grant.assert_called_once()

    async def test_existing_grant_not_granted(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_strategy_mock.grant.assert_called_once()

    async def test_existing_grant_already_granted(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        benefit_strategy_mock.grant.assert_not_called()

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        error_message = "Action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert not grant.is_granted
        assert grant.error is not None
        assert grant.error["message"] == error_message
        assert grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in grant.error

    async def test_default_properties_value(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.side_effect = (
            lambda customer, benefit, properties, **kwargs: properties
        )

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.properties == {}


@pytest.mark.asyncio
class TestRevokeBenefit:
    async def test_not_existing_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.subscription_id == subscription.id
        assert grant.benefit_id == benefit_organization.id
        assert grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_existing_grant_not_revoked(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.revoke.return_value = {"message": "ok"}

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        assert cast(Any, updated_grant.properties) == {"message": "ok"}
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_existing_grant_already_revoked(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_several_benefit_grants(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        product: Product,
    ) -> None:
        first_grant = await create_benefit_grant(
            save_fixture, customer, benefit_organization, subscription=subscription
        )
        first_grant.set_granted()
        await save_fixture(first_grant)

        second_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        second_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=second_subscription,
        )
        second_grant.set_granted()
        await save_fixture(second_grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == first_grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_several_benefit_grants_should_individual_revoke(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
        product: Product,
    ) -> None:
        benefit_strategy_mock.should_revoke_individually = True
        benefit_strategy_mock.revoke.return_value = {"message": "ok"}

        first_grant = await create_benefit_grant(
            save_fixture, customer, benefit_organization, subscription=subscription
        )
        first_grant.set_granted()
        await save_fixture(first_grant)

        second_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        second_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=second_subscription,
        )
        second_grant.set_granted()
        await save_fixture(second_grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == first_grant.id
        assert updated_grant.is_revoked
        assert cast(Any, updated_grant.properties) == {"message": "ok"}
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        error_message = "Revoke action required error message"
        benefit_strategy_mock.revoke.side_effect = BenefitActionRequiredError(
            error_message
        )

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
        )
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        # In revoke_benefit, we don't set the error field when BenefitActionRequiredError is raised
        # This is because we always want to mark the grant as revoked, regardless of errors
        benefit_strategy_mock.revoke.assert_called_once()


@pytest.mark.asyncio
class TestEnqueueBenefitsGrants:
    @pytest.mark.parametrize("task", ["grant", "revoke"])
    async def test_subscription_scope(
        self,
        task: Literal["grant", "revoke"],
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, task, customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    f"benefit.{task}",
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    subscription_id=subscription.id,
                )
                for benefit in benefits
            ]
        )

    async def test_outdated_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
        customer: Customer,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefits[0]
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits[1:]
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_any_call(
            "benefit.revoke",
            customer_id=customer.id,
            benefit_id=benefits[0].id,
            subscription_id=subscription.id,
        )


@pytest.mark.asyncio
class TestEnqueueBenefitGrantUpdates:
    async def test_not_required_update(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = False

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()

    async def test_required_update_granted(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
        )
        granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = True

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.update",
            benefit_grant_id=granted_grant.id,
        )

    async def test_required_update_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        revoked_grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        benefit_strategy_mock.requires_update.return_value = True

        await benefit_grant_service.enqueue_benefit_grant_updates(
            session, redis, benefit_organization, {}
        )

        enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
class TestUpdateBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.grant.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.grant.return_value = {"external_id": "xyz"}

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            properties={"external_id": "abc"},
        )
        grant.set_granted()
        await save_fixture(grant)

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id, loaded=True)
        assert grant_loaded

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant_loaded
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        assert cast(Any, updated_grant.properties) == {"external_id": "xyz"}
        benefit_strategy_mock.grant.assert_called_once()
        assert benefit_strategy_mock.grant.call_args[1]["update"] is True

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        error_message = "Update action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id, loaded=True)
        assert grant_loaded

        updated_grant = await benefit_grant_service.update_benefit_grant(
            session, redis, grant_loaded
        )

        assert not updated_grant.is_granted
        assert updated_grant.error is not None
        assert updated_grant.error["message"] == error_message
        assert updated_grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in updated_grant.error


@pytest.mark.asyncio
class TestEnqueueBenefitGrantCycles:
    async def test_required_update_revoked(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        revoked_grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
        )
        grant.set_granted()
        await save_fixture(grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_benefit_grant_cycles(
            session, redis, subscription=subscription
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.cycle", benefit_grant_id=grant.id
        )


@pytest.mark.asyncio
class TestCycleBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.cycle.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        benefit_strategy_mock.cycle.return_value = {"external_id": "xyz"}
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            properties={"external_id": "abc"},
            subscription=subscription,
        )

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        benefit_strategy_mock.cycle.assert_called_once()

        assert updated_grant.id == grant.id
        assert updated_grant.is_granted
        assert cast(Any, updated_grant.properties) == {"external_id": "xyz"}

    async def test_action_required_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        error_message = "Cycle action required error message"
        benefit_strategy_mock.cycle.side_effect = BenefitActionRequiredError(
            error_message
        )

        updated_grant = await benefit_grant_service.cycle_benefit_grant(
            session, redis, grant
        )

        benefit_strategy_mock.cycle.assert_called_once()
        assert not updated_grant.is_granted
        assert updated_grant.error is not None
        assert updated_grant.error["message"] == error_message
        assert updated_grant.error["type"] == "BenefitActionRequiredError"
        assert "timestamp" in updated_grant.error


@pytest.mark.asyncio
class TestEnqueueBenefitGrantDeletions:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
    ) -> None:
        granted_grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        granted_grant.set_granted()
        await save_fixture(granted_grant)

        other_benefit_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
        )
        other_benefit_grant.set_granted()
        await save_fixture(other_benefit_grant)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_benefit_grant_deletions(
            session, benefit_organization
        )

        enqueue_job_mock.assert_called_once_with(
            "benefit.delete_grant", benefit_grant_id=granted_grant.id
        )


@pytest.mark.asyncio
class TestEnqueueCustomerGrantDeletions:
    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
    ) -> None:
        grant1 = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant1.set_granted()
        await save_fixture(grant1)

        grant2 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization_second,
        )
        grant2.set_granted()
        await save_fixture(grant2)

        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        await benefit_grant_service.enqueue_customer_grant_deletions(session, customer)

        enqueue_job_mock.assert_has_calls(
            [
                call("benefit.delete_grant", benefit_grant_id=grant1.id),
                call("benefit.delete_grant", benefit_grant_id=grant2.id),
            ]
        )


@pytest.mark.asyncio
class TestDeleteBenefitGrant:
    async def test_revoked_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_revoked()
        await save_fixture(grant)

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant
        )

        assert updated_grant.id == grant.id
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_granted_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        grant.set_granted()
        await save_fixture(grant)

        # load
        grant_loaded = await benefit_grant_service.get(session, grant.id)
        assert grant_loaded

        updated_grant = await benefit_grant_service.delete_benefit_grant(
            session, redis, grant_loaded
        )

        assert updated_grant.id == grant.id
        assert updated_grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()


@pytest.mark.asyncio
class TestGetByBenefitAndScope:
    async def test_existing_grant_incorrect_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        product: Product,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        await save_fixture(grant)

        other_subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(save_fixture, product=product, customer=customer)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=other_subscription, order=order
        )
        assert retrieved_grant is None

    async def test_existing_grant_correct_scope(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefit_organization
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=subscription
        )
        assert retrieved_grant is not None
        assert retrieved_grant.id == grant.id
