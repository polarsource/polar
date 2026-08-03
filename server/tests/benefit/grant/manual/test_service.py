from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.benefit.grant.manual.service import (
    manual_grant as manual_grant_service,
)
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
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

    async def test_grant_worker_does_not_override_revoked_manual_grant(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
            manual_grant=manual_grant,
        )
        benefit_strategy_mock.grant.reset_mock()

        result = await benefit_grant_service.grant_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            manual_grant=manual_grant,
        )

        assert result.id == grant.id
        assert result.is_revoked is True
        assert result.is_granted is False
        benefit_strategy_mock.grant.assert_not_called()

    async def test_successful_manual_revoke_clears_previous_error(
        self,
        session: AsyncSession,
        redis: Redis,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        benefit_strategy_mock: MagicMock,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )
        grant.set_revoke_failed(RuntimeError("Revocation failed"))
        await save_fixture(grant)

        result = await benefit_grant_service.revoke_benefit(
            session,
            redis,
            customer,
            benefit_organization,
            manual_grant=manual_grant,
        )

        assert result.is_revoked is True
        assert result.error is None


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
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        manual_grant = await manual_grant_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            benefit_ids=[benefit_organization.id],
            reason="Customer success exception",
        )

        assert manual_grant.customer_id == customer.id
        assert manual_grant.reason == "Customer success exception"
        assert len(manual_grant.grants) == 1
        assert manual_grant.grants[0].is_granted is False
        assert manual_grant.grants[0].is_revoked is False
        enqueue_mock.assert_called_once_with(
            "benefit.grant",
            customer_id=customer.id,
            benefit_id=benefit_organization.id,
            member_id=manual_grant.grants[0].member_id,
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
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
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
            benefit_ids=[benefit_organization.id, other_benefit.id],
        )

        assert manual_grant.customer_id == customer.id
        assert {grant.benefit_id for grant in manual_grant.grants} == {
            benefit_organization.id,
            other_benefit.id,
        }
        assert {grant.manual_grant_id for grant in manual_grant.grants} == {
            manual_grant.id
        }
        assert {
            call.kwargs["manual_grant_id"] for call in enqueue_mock.call_args_list
        } == {manual_grant.id}
        assert {call.kwargs["benefit_id"] for call in enqueue_mock.call_args_list} == {
            benefit_organization.id,
            other_benefit.id,
        }

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
        mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
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
            benefit_ids=[benefit_organization.id],
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
                benefit_ids=[benefit_organization.id, benefit_organization.id],
            )

    @pytest.mark.auth
    async def test_already_manually_granted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        existing = await create_manual_grant(save_fixture, customer=customer)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=existing,
        )

        with pytest.raises(PolarRequestValidationError):
            await manual_grant_service.create(
                session,
                auth_subject,
                customer_id=customer.id,
                benefit_ids=[benefit_organization.id],
            )

    @pytest.mark.auth
    async def test_revoked_manual_grant_allows_regrant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
        existing = await create_manual_grant(save_fixture, customer=customer)
        revoked = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=existing,
        )
        revoked.set_revoked()
        await save_fixture(revoked)

        manual_grant = await manual_grant_service.create(
            session,
            auth_subject,
            customer_id=customer.id,
            benefit_ids=[benefit_organization.id],
        )

        assert len(manual_grant.grants) == 1

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
                benefit_ids=[benefit.id],
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
                benefit_ids=[benefit.id],
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
                benefit_ids=[benefit_organization.id],
            )


@pytest.mark.asyncio
class TestRequestRevoke:
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

        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
        await manual_grant_service.request_revoke(session, grant)

        enqueue_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            manual_grant_id=manual_grant.id,
        )

    @pytest.mark.auth
    async def test_skips_already_revoked(
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
        grant.set_revoked()
        await save_fixture(grant)
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        await manual_grant_service.request_revoke(session, grant)

        enqueue_mock.assert_not_called()

    @pytest.mark.auth
    async def test_retries_failed_revoke(
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
        grant.set_revoke_failed(RuntimeError("Revocation failed"))
        await save_fixture(grant)
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        await manual_grant_service.request_revoke(session, grant)

        enqueue_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            manual_grant_id=manual_grant.id,
        )


@pytest.mark.asyncio
class TestRequestRevokeExpired:
    async def test_enqueues_expired_grants_until_revoked(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        manual_grant = await create_manual_grant(
            save_fixture,
            customer=customer,
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        count = await manual_grant_service.request_revoke_expired(session, limit=100)
        assert count == 1
        enqueue_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            manual_grant_id=manual_grant.id,
        )

        # Still active until the revoke worker runs — cron may see it again.
        second_count = await manual_grant_service.request_revoke_expired(
            session, limit=100
        )
        assert second_count == 1

        grant.set_revoked()
        await save_fixture(grant)
        enqueue_mock.reset_mock()

        third_count = await manual_grant_service.request_revoke_expired(
            session, limit=100
        )
        assert third_count == 0
        enqueue_mock.assert_not_called()

    async def test_skips_already_revoked_siblings(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        customer: Customer,
        organization: Organization,
        benefit_organization: Benefit,
    ) -> None:
        other_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.feature_flag,
            properties={"flag": "other-flag"},
        )
        manual_grant = await create_manual_grant(
            save_fixture,
            customer=customer,
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        revoked_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )
        revoked_grant.set_revoked()
        await save_fixture(revoked_grant)
        active_grant = await create_benefit_grant(
            save_fixture,
            customer,
            other_benefit,
            granted=True,
            manual_grant=manual_grant,
        )
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        count = await manual_grant_service.request_revoke_expired(session, limit=100)

        assert count == 1
        enqueue_mock.assert_called_once_with(
            "benefit.revoke",
            customer_id=active_grant.customer_id,
            benefit_id=active_grant.benefit_id,
            member_id=active_grant.member_id,
            manual_grant_id=manual_grant.id,
        )
