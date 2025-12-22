from typing import Any, cast
from unittest.mock import MagicMock, call

import pytest
from pytest_mock import MockerFixture

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.strategies import BenefitActionRequiredError, BenefitServiceProtocol
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Organization,
    Product,
    Subscription,
)
from polar.models.member import MemberRole
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit_grant,
    create_customer,
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

    async def test_revoked_grant_action_required_error(
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

        error_message = "Action required error message"
        benefit_strategy_mock.grant.side_effect = BenefitActionRequiredError(
            error_message
        )

        updated_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )

        assert grant.error is not None
        assert grant.error["message"] == error_message
        assert grant.error["type"] == "BenefitActionRequiredError"
        assert grant.granted_at is None
        assert grant.revoked_at is None

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
    async def test_grant_no_existing_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Test that all benefits are enqueued when there are no existing grants."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.grant",
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    member_id=None,
                    subscription_id=subscription.id,
                )
                for benefit in benefits
            ]
        )

    async def test_grant_skips_already_granted_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Test that already granted benefits are skipped."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        # Grant the first benefit
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefits[0]
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        # Should only enqueue remaining benefits (not the already granted one)
        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.grant",
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    member_id=None,
                    subscription_id=subscription.id,
                )
                for benefit in benefits[1:]
            ]
        )
        # Verify the granted benefit was NOT enqueued
        for c in enqueue_job_mock.call_args_list:
            if c[0][0] == "benefit.grant":
                assert c[1]["benefit_id"] != benefits[0].id

    async def test_grant_skips_errored_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Test that benefits with errors (e.g., BenefitActionRequiredError) are skipped."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        # Create a grant with an error for the first benefit
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefits[0]
        )
        grant.set_grant_failed(BenefitActionRequiredError("Connect GitHub"))
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "grant", customer, product, subscription=subscription
        )

        # Should only enqueue remaining benefits (not the errored one)
        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.grant",
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    member_id=None,
                    subscription_id=subscription.id,
                )
                for benefit in benefits[1:]
            ]
        )
        # Verify the errored benefit was NOT enqueued
        for c in enqueue_job_mock.call_args_list:
            if c[0][0] == "benefit.grant":
                assert c[1]["benefit_id"] != benefits[0].id

    async def test_revoke_only_granted_benefits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Test that only granted benefits are revoked."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        # Grant only the first benefit
        grant = BenefitGrant(
            subscription=subscription, customer=customer, benefit=benefits[0]
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "revoke", customer, product, subscription=subscription
        )

        # Should only enqueue revoke for the granted benefit
        enqueue_job_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=customer.id,
            benefit_id=benefits[0].id,
            member_id=None,
            subscription_id=subscription.id,
        )

    async def test_revoke_no_grants_enqueues_nothing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        """Test that no revoke jobs are enqueued when there are no grants."""
        enqueue_job_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")

        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )

        await benefit_grant_service.enqueue_benefits_grants(
            session, "revoke", customer, product, subscription=subscription
        )

        enqueue_job_mock.assert_not_called()

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
            member_id=None,
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

    async def test_grant_with_member_found(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant with member is found when querying with same member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member.id,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member, subscription=subscription
        )
        assert retrieved_grant is not None
        assert retrieved_grant.id == grant.id
        assert retrieved_grant.member_id == member.id

    async def test_grant_with_member_not_found_when_querying_without_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant with member is NOT found when querying without member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member.id,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        # Query without member - should not find grant with member_id set
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, subscription=subscription
        )
        assert retrieved_grant is None

    async def test_grant_without_member_not_found_when_querying_with_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that grant without member is NOT found when querying with member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Grant without member
        grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=None,
        )
        await save_fixture(grant)

        repository = BenefitGrantRepository.from_session(session)
        # Query with member - should not find grant without member_id
        retrieved_grant = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member, subscription=subscription
        )
        assert retrieved_grant is None

    async def test_different_members_create_separate_grants(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        organization: Organization,
    ) -> None:
        """Test that different members with different customers can have separate grants.

        In B2B scenarios, each seat holder (member) is typically the same customer (billing).
        This test verifies that the repository correctly queries by member.
        """
        customer = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )

        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.member,
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        grant1 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member1.id,
        )
        await save_fixture(grant1)

        grant2 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member2.id,
        )
        await save_fixture(grant2)

        repository = BenefitGrantRepository.from_session(session)

        retrieved_grant1 = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member1, subscription=subscription
        )
        assert retrieved_grant1 is not None
        assert retrieved_grant1.id == grant1.id

        retrieved_grant2 = await repository.get_by_benefit_and_scope(
            customer, benefit_organization, member=member2, subscription=subscription
        )
        assert retrieved_grant2 is not None
        assert retrieved_grant2.id == grant2.id


@pytest.mark.asyncio
class TestGrantBenefitWithMember:
    """Tests for grant_benefit with member support."""

    async def test_grant_with_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test granting benefit with a member creates grant with member_id."""
        benefit_strategy_mock.grant.return_value = {"external_id": "abc"}

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        grant = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert grant.member_id == member.id
        assert grant.customer_id == customer.id
        assert grant.is_granted
        benefit_strategy_mock.grant.assert_called_once()

    async def test_grant_updates_existing_member_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test that granting to same member updates existing grant."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        # Create existing grant for this member
        existing_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member.id,
        )
        await save_fixture(existing_grant)

        # Grant again with same member
        updated_grant = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert updated_grant.id == existing_grant.id
        assert updated_grant.member_id == member.id
        assert updated_grant.is_granted

    async def test_grant_different_members_with_different_customers_creates_separate_grants(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test that granting to different members creates separate grants.

        In B2B scenarios, each seat holder (member) belongs to the same customer.
        """
        customer = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )

        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.member,
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        grant1 = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member1,
            subscription=subscription,
        )

        grant2 = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member2,
            subscription=subscription,
        )

        assert grant1.id != grant2.id
        assert grant1.member_id == member1.id
        assert grant2.member_id == member2.id
        assert grant1.customer_id == customer.id
        assert grant2.customer_id == customer.id


@pytest.mark.asyncio
class TestRevokeBenefitWithMember:
    """Tests for revoke_benefit with member support."""

    async def test_revoke_with_member(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test revoking benefit for a specific member."""
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role=MemberRole.member,
        )
        await save_fixture(member)

        existing_grant = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member.id,
        )
        existing_grant.set_granted()
        await save_fixture(existing_grant)

        revoked_grant = await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member,
            subscription=subscription,
        )

        assert revoked_grant.id == existing_grant.id
        assert revoked_grant.member_id == member.id
        assert revoked_grant.is_revoked
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_revoke_specific_member_does_not_affect_others(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        organization: Organization,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """Test that revoking for one member doesn't affect another member's grant.

        In B2B scenarios, each seat holder (member) belongs to the same customer.
        """
        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )

        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role=MemberRole.member,
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role=MemberRole.member,
        )
        await save_fixture(member2)

        # Create grants for both members
        grant1 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member1.id,
        )
        grant1.set_granted()
        await save_fixture(grant1)

        grant2 = BenefitGrant(
            subscription=subscription,
            customer=customer,
            benefit=benefit_organization,
            member_id=member2.id,
        )
        grant2.set_granted()
        await save_fixture(grant2)

        # Revoke for member1 only
        await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            member=member1,
            subscription=subscription,
        )

        # Refresh grants
        await session.refresh(grant1)
        await session.refresh(grant2)

        # Member1's grant should be revoked
        assert grant1.is_revoked

        # Member2's grant should still be granted
        assert grant2.is_granted
