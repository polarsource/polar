import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.authz.service import Authz
from polar.exceptions import NotPermitted
from polar.integrations.stripe.service import StripeService
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Organization,
    Subscription,
    SubscriptionBenefit,
    SubscriptionBenefitGrant,
    SubscriptionTier,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.repository import Repository
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.subscription.schemas import SubscriptionUpgrade
from polar.subscription.service.subscription import (
    AssociatedSubscriptionTierDoesNotExist,
    InvalidSubscriptionTierUpgrade,
    SubscriptionDoesNotExist,
)
from polar.subscription.service.subscription import subscription as subscription_service
from polar.transaction.service.transfer import TransferTransactionService
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
    latest_invoice: stripe_lib.Invoice | None = None,
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
            "latest_invoice": latest_invoice,
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


def construct_stripe_invoice(
    *,
    id: str = "INVOICE_ID",
    total: int = 12000,
    tax: int = 2000,
    charge_id: str = "CHARGE_ID",
    metadata: dict[str, str] = {},
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "total": total,
            "tax": tax,
            "currency": "usd",
            "charge": charge_id,
            "metadata": metadata,
        },
        None,
    )


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch(
        "polar.subscription.service.subscription.stripe_service",
        spec=StripeService,
    )


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


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
        stripe_service_mock: MagicMock,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            product_id=subscription_tier_organization.stripe_product_id
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
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

        assert subscription.stripe_subscription_id == stripe_subscription.id
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
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        updated_subscription = await subscription_service.update_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None

        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants",
            updated_subscription.id,
        )
        enqueue_job_mock.assert_any_await(
            "subscription.subscription.transfer_subscription_money",
            updated_subscription.id,
        )


@pytest.mark.asyncio
class TestTransferSubscriptionMoney:
    async def test_no_associated_invoice(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        stripe_subscription = construct_stripe_subscription()
        stripe_service_mock = mocker.patch(
            "polar.subscription.service.subscription.stripe_service", spec=StripeService
        )
        stripe_service_mock.get_subscription.return_value = stripe_subscription

        transaction_service_mock = mocker.patch(
            "polar.subscription.service.subscription.transfer_transaction_service",
            spec=TransferTransactionService,
        )

        await subscription_service.transfer_subscription_money(session, subscription)

        transaction_service_mock.create_transfer.assert_not_called()

    async def test_already_transferred(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
    ) -> None:
        stripe_invoice = construct_stripe_invoice(metadata={"transferred_at": "123"})
        stripe_subscription = construct_stripe_subscription(
            latest_invoice=stripe_invoice
        )
        stripe_service_mock = mocker.patch(
            "polar.subscription.service.subscription.stripe_service", spec=StripeService
        )
        stripe_service_mock.get_subscription.return_value = stripe_subscription

        transaction_service_mock = mocker.patch(
            "polar.subscription.service.subscription.transfer_transaction_service",
            spec=TransferTransactionService,
        )

        await subscription_service.transfer_subscription_money(session, subscription)

        transaction_service_mock.create_transfer.assert_not_called()

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
        organization_account: Account,
    ) -> None:
        stripe_invoice = construct_stripe_invoice()
        stripe_subscription = construct_stripe_subscription(
            latest_invoice=stripe_invoice
        )
        stripe_service_mock = mocker.patch(
            "polar.subscription.service.subscription.stripe_service", spec=StripeService
        )
        stripe_service_mock.get_subscription.return_value = stripe_subscription

        transaction_service_mock = mocker.patch(
            "polar.subscription.service.subscription.transfer_transaction_service",
            spec=TransferTransactionService,
        )
        transaction_service_mock.create_transfer.return_value = (
            Transaction(transfer_id="STRIPE_TRANSFER_ID"),
            Transaction(transfer_id="STRIPE_TRANSFER_ID"),
        )

        await subscription_service.transfer_subscription_money(session, subscription)

        transaction_service_mock.create_transfer.assert_called_once()
        assert (
            transaction_service_mock.create_transfer.call_args[1][
                "destination_account"
            ].id
            == organization_account.id
        )
        assert transaction_service_mock.create_transfer.call_args[1]["amount"] == 9000

        stripe_service_mock.update_invoice.assert_called_once()


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

    async def test_outdated_grants(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefits[0].id,
        )
        grant.set_granted()
        session.add(grant)
        await session.commit()

        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits[1:],
        )
        subscription.status = SubscriptionStatus.active

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_any_await(
            "subscription.subscription_benefit.revoke",
            subscription_id=subscription.id,
            subscription_benefit_id=subscription_benefits[0].id,
        )


@pytest.mark.asyncio
class TestSearch:
    async def test_not_organization_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results, count = await subscription_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 0
        assert count == 0

    async def test_organization_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results, count = await subscription_service.search(
            session, user, organization=organization, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1

    async def test_own_subscription(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
        subscription_tier_organization: SubscriptionTier,
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
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results, count = await subscription_service.search(
            session,
            user_second,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1


@pytest.mark.asyncio
class TestUpgradeSubscription:
    async def test_not_permitted(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        user_second: User,
    ) -> None:
        with pytest.raises(NotPermitted):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4()
                ),
                authz=authz,
                user=user_second,
            )

    async def test_not_existing_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        user: User,
    ) -> None:
        with pytest.raises(InvalidSubscriptionTierUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4()
                ),
                authz=authz,
                user=user,
            )

    async def test_extraneous_tier(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        subscription_tier_repository: SubscriptionTier,
        user: User,
    ) -> None:
        with pytest.raises(InvalidSubscriptionTierUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=subscription_tier_repository.id
                ),
                authz=authz,
                user=user,
            )

    async def test_valid(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        authz: Authz,
        subscription: Subscription,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_second: SubscriptionTier,
        user: User,
    ) -> None:
        updated_subscription = await subscription_service.upgrade_subscription(
            session,
            subscription=subscription,
            subscription_upgrade=SubscriptionUpgrade(
                subscription_tier_id=subscription_tier_organization_second.id
            ),
            authz=authz,
            user=user,
        )

        assert (
            updated_subscription.subscription_tier_id
            == subscription_tier_organization_second.id
        )
        assert (
            updated_subscription.price_currency
            == subscription_tier_organization_second.price_currency
        )
        assert (
            updated_subscription.price_amount
            == subscription_tier_organization_second.price_amount
        )

        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            old_price=subscription_tier_organization.stripe_price_id,
            new_price=subscription_tier_organization_second.stripe_price_id,
        )


@pytest.mark.asyncio
class TestGetStatisticsPeriods:
    async def test_not_organization_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_second: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        user2 = await create_user(session)
        await UserOrganization(
            user_id=user2.id,
            organization_id=organization.id,
        ).save(
            session=session,
        )
        user3 = await create_user(session)
        await UserOrganization(
            user_id=user3.id,
            organization_id=organization.id,
        ).save(
            session=session,
        )

        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results = await subscription_service.get_statistics_periods(
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
