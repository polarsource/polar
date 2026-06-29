from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.manual_grant.schemas import ManualGrantBenefitCreate
from polar.benefit.manual_grant.service import (
    manual_grant as manual_grant_service,
)
from polar.exceptions import PolarRequestValidationError
from polar.models import (
    Benefit,
    Customer,
    Organization,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_manual_grant,
)


@pytest.mark.asyncio
class TestManualGrantScope:
    """Verify the third scope key materializes ordinary BenefitGrant rows and
    coexists with subscription/order grants (AC 1, 2, 3, 7)."""

    async def test_grant_materializes_manual_grant_scoped_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)

        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, manual_grant=manual_grant
        )

        assert grant.manual_grant_id == manual_grant.id
        assert grant.subscription_id is None
        assert grant.order_id is None
        assert grant.is_granted

    async def test_coexistence_subscription_and_manual_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """feature_flag-like: two active grants, single effective entitlement.
        Revoking one keeps the benefit live (strategy revoke skipped)."""
        sub_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, manual_grant=manual_grant
        )

        assert sub_grant.id != grant.id
        assert sub_grant.is_granted
        assert grant.is_granted

        benefit_strategy_mock.revoke.reset_mock()
        await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit_organization, manual_grant=manual_grant
        )

        await session.refresh(sub_grant)
        await session.refresh(grant)
        assert grant.is_revoked
        assert sub_grant.is_granted
        # Other grant keeps it live → individual strategy revoke skipped.
        benefit_strategy_mock.revoke.assert_not_called()

    async def test_license_keys_coexistence_individual_revoke(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        """license_keys: two distinct keys (one per grant); revoke is per-grant."""
        benefit_strategy_mock.should_revoke_individually = True
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.license_keys,
            properties={
                "prefix": None,
                "expires": None,
                "activations": None,
                "limit_usage": None,
            },
        )

        sub_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, subscription=subscription
        )
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit, manual_grant=manual_grant
        )

        benefit_strategy_mock.revoke.reset_mock()
        await benefit_grant_service.revoke_benefit(
            session, redis, customer, benefit, manual_grant=manual_grant
        )

        await session.refresh(sub_grant)
        await session.refresh(grant)
        assert grant.is_revoked
        assert sub_grant.is_granted
        # Each grant owns its own key → individual revoke runs.
        benefit_strategy_mock.revoke.assert_called_once()

    async def test_no_cycles_for_manual_grants(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        sub_grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, subscription=subscription
        )
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await benefit_grant_service.grant_benefit(
            session, redis, customer, benefit_organization, manual_grant=manual_grant
        )

        enqueue_mock = mocker.patch("polar.benefit.grant.service.enqueue_job")
        await benefit_grant_service.enqueue_benefit_grant_cycles(
            session, redis, subscription=subscription
        )

        cycled_ids = {c.kwargs["benefit_grant_id"] for c in enqueue_mock.call_args_list}
        assert sub_grant.id in cycled_ids
        assert grant.id not in cycled_ids


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        enqueue_mock = mocker.patch("polar.benefit.manual_grant.service.enqueue_job")

        manual_grant = await manual_grant_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            grants=[ManualGrantBenefitCreate(benefit_id=benefit_organization.id)],
        )

        assert manual_grant.customer_id == customer.id
        enqueue_mock.assert_called_once_with(
            "benefit.grant",
            customer_id=customer.id,
            benefit_id=benefit_organization.id,
            member_id=None,
            manual_grant_id=manual_grant.id,
        )

    @pytest.mark.auth
    async def test_valid_multiple_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        enqueue_mock = mocker.patch("polar.benefit.manual_grant.service.enqueue_job")
        other_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={"flag": "my-flag"},
        )

        manual_grant = await manual_grant_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            grants=[
                ManualGrantBenefitCreate(benefit_id=benefit_organization.id),
                ManualGrantBenefitCreate(benefit_id=other_benefit.id),
            ],
        )

        assert manual_grant.customer_id == customer.id
        granted_benefit_ids = {
            call.kwargs["benefit_id"] for call in enqueue_mock.call_args_list
        }
        assert granted_benefit_ids == {benefit_organization.id, other_benefit.id}
        for call in enqueue_mock.call_args_list:
            assert call.kwargs["manual_grant_id"] == manual_grant.id

    @pytest.mark.auth
    async def test_coexists_with_subscription_grant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
    ) -> None:
        """A subscription-scoped grant of the same benefit doesn't block a manual
        grant: they coexist as distinct scopes."""
        mocker.patch("polar.benefit.manual_grant.service.enqueue_job")
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        manual_grant = await manual_grant_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            grants=[ManualGrantBenefitCreate(benefit_id=benefit_organization.id)],
        )

        assert manual_grant.customer_id == customer.id

    @pytest.mark.auth
    async def test_duplicate_benefit_in_request(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await manual_grant_service.create(
                session,
                auth_subject,
                customer_id=customer.id,
                grants=[
                    ManualGrantBenefitCreate(benefit_id=benefit_organization.id),
                    ManualGrantBenefitCreate(benefit_id=benefit_organization.id),
                ],
            )

    @pytest.mark.auth
    async def test_ineligible_benefit_type(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
        )

        with pytest.raises(PolarRequestValidationError):
            await manual_grant_service.create(
                session,
                auth_subject,
                customer_id=customer.id,
                grants=[ManualGrantBenefitCreate(benefit_id=benefit.id)],
            )

    @pytest.mark.auth
    async def test_benefit_not_accessible(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization_second: Organization,
        customer: Customer,
    ) -> None:
        benefit = await create_benefit(save_fixture, organization=organization_second)

        with pytest.raises(PolarRequestValidationError):
            await manual_grant_service.create(
                session,
                auth_subject,
                customer_id=customer.id,
                grants=[ManualGrantBenefitCreate(benefit_id=benefit.id)],
            )

    @pytest.mark.auth
    async def test_cross_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        organization_second: Organization,
        benefit_organization: Benefit,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )
        other_customer = await create_customer(
            save_fixture, organization=organization_second
        )

        with pytest.raises(PolarRequestValidationError):
            await manual_grant_service.create(
                session,
                auth_subject,
                customer_id=other_customer.id,
                grants=[ManualGrantBenefitCreate(benefit_id=benefit_organization.id)],
            )


@pytest.mark.asyncio
class TestRevokeGrant:
    @pytest.mark.auth
    async def test_enqueues_revoke(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )

        enqueue_mock = mocker.patch("polar.benefit.manual_grant.service.enqueue_job")
        await manual_grant_service.revoke_grant(manual_grant, grant)

        enqueue_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=customer.id,
            benefit_id=benefit_organization.id,
            member_id=None,
            manual_grant_id=manual_grant.id,
        )
