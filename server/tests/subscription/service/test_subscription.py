from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import (
    Organization,
    Subscription,
    SubscriptionBenefit,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.models.repository import Repository
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.subscription.service.subscription import (
    AssociatedSubscriptionTierDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.subscription.service.subscription import subscription as subscription_service
from polar.user.service import user as user_service
from tests.fixtures.random_objects import create_user

from ..conftest import (
    add_subscription_benefits,
    create_active_subscription,
    create_subscription,
)


def construct_stripe_subscription(
    *,
    customer_id: str = "CUSTOMER_ID",
    product_id: str = "PRODUCT_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    return stripe_lib.Subscription.construct_from(
        {
            "id": "SUBSCRIPTION_ID",
            "customer": customer_id,
            "status": status,
            "items": {
                "data": [
                    {
                        "price": {
                            "product": product_id,
                            "currency": "USD",
                            "unit_amount": 1000,
                        }
                    }
                ]
            },
            "current_period_start": now_timestamp,
            "current_period_end": now_timestamp + timedelta(days=30).seconds,
            "cancel_at_period_end": False,
            "ended_at": None,
        },
        None,
    )


def construct_stripe_customer(
    *, id: str = "CUSTOMER_ID", email: str = "backer@example.com"
) -> stripe_lib.Customer:
    return stripe_lib.Customer.construct_from(
        {
            "id": id,
            "email": email,
        },
        None,
    )


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.subscription.service.subscription.stripe_service",
        spec=StripeService,
    )


@pytest.mark.asyncio
class TestCreateSubscription:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()
        with pytest.raises(AssociatedSubscriptionTierDoesNotExist):
            await subscription_service.create_subscription(
                session, stripe_subscription=stripe_subscription
            )

    async def test_new_user(
        self,
        session: AsyncSession,
        mock_stripe_service: MagicMock,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = mock_stripe_service.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.stripe_id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        user = await user_service.get(session, subscription.user_id)
        assert user is not None
        assert user.email == stripe_customer.email
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_existing_user(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id
        )

        await user.update(session, stripe_customer_id=stripe_subscription.customer)

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.stripe_id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        assert subscription.user_id == user.id

    async def test_set_started_at(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id,
            status=SubscriptionStatus.active,
        )

        await user.update(session, stripe_customer_id=stripe_subscription.customer)

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.started_at is not None


@pytest.mark.asyncio
class TestUpdateSubscription:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()
        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_subscription(
                session, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active
        )
        subscription = await create_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            stripe_subscription_id=stripe_subscription.stripe_id,
        )
        assert subscription.started_at is None

        updated_subscription = await subscription_service.update_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None

        enqueue_job_mock.assert_awaited_once_with(
            "subscription.subscription.enqueue_benefits_grants",
            updated_subscription.id,
        )


@pytest.mark.asyncio
class TestEnqueueBenefitsGrants:
    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.incomplete, SubscriptionStatus.incomplete_expired]
    )
    async def test_incomplete_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )
        subscription.status = status

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_not_called()

    @pytest.mark.parametrize(
        "status", [SubscriptionStatus.trialing, SubscriptionStatus.active]
    )
    async def test_active_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )
        subscription.status = status

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_awaits(
            [
                call(
                    "subscription.subscription_benefit.grant",
                    subscription_id=subscription.id,
                    subscription_benefit_id=benefit.id,
                )
                for benefit in subscription_benefits
            ]
        )

    @pytest.mark.parametrize(
        "status",
        [
            SubscriptionStatus.past_due,
            SubscriptionStatus.canceled,
            SubscriptionStatus.unpaid,
        ],
    )
    async def test_canceled_subscription(
        self,
        status: SubscriptionStatus,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )
        subscription.status = status

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_awaits(
            [
                call(
                    "subscription.subscription_benefit.revoke",
                    subscription_id=subscription.id,
                    subscription_benefit_id=benefit.id,
                )
                for benefit in subscription_benefits
            ]
        )


@pytest.mark.asyncio
class TestGetSummary:
    async def test_not_organization_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for result in results:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == 0

    async def test_organization_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == subscription_tier_organization.price_amount
            assert result.cumulative == subscription_tier_organization.price_amount * (
                i + 1
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == subscription_tier_organization.price_amount * 6

    async def test_multiple_users_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        user2 = await create_user(session)
        await UserOrganization.create(
            session=session,
            user_id=user2.id,
            organization_id=organization.id,
        )
        user3 = await create_user(session)
        await UserOrganization.create(
            session=session,
            user_id=user3.id,
            organization_id=organization.id,
        )

        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == subscription_tier_organization.price_amount
            assert result.cumulative == subscription_tier_organization.price_amount * (
                i + 1
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == subscription_tier_organization.price_amount * 6

    async def test_filter_indirect_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            direct_organization=False,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 2
            assert (
                result.mrr
                == subscription_tier_organization.price_amount
                + subscription_tier_repository.price_amount
            )
            assert result.cumulative == (
                subscription_tier_organization.price_amount
                + subscription_tier_repository.price_amount
            ) * (i + 1)

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert (
                result.cumulative
                == (
                    subscription_tier_organization.price_amount
                    + subscription_tier_repository.price_amount
                )
                * 6
            )

    async def test_filter_repository(
        self,
        session: AsyncSession,
        public_repository: Repository,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            repository=public_repository,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == subscription_tier_repository.price_amount
            assert result.cumulative == subscription_tier_repository.price_amount * (
                i + 1
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == subscription_tier_repository.price_amount * 6

    async def test_filter_type(
        self,
        session: AsyncSession,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            type=SubscriptionTierType.business,
        )

        assert len(results) == 12

        for result in results:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == 0

    async def test_filter_subscription_tier_id(
        self,
        session: AsyncSession,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_periods_summary(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            subscription_tier_id=subscription_tier_organization.id,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == subscription_tier_organization.price_amount
            assert result.cumulative == subscription_tier_organization.price_amount * (
                i + 1
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == subscription_tier_organization.price_amount * 6
