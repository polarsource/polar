import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pydantic import EmailStr
from pytest_mock import MockerFixture

from polar.auth.dependencies import AuthMethod
from polar.authz.service import Anonymous, Authz
from polar.config import settings
from polar.exceptions import NotPermitted, ResourceNotFound
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
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.postgres import AsyncSession
from polar.subscription.schemas import FreeSubscriptionCreate, SubscriptionUpgrade
from polar.subscription.service.subscription import (
    AlreadyCanceledSubscription,
    AlreadySubscribed,
    AssociatedSubscriptionTierDoesNotExist,
    FreeSubscriptionUpgrade,
    InvalidSubscriptionTierUpgrade,
    NotAFreeSubscriptionTier,
    RequiredCustomerEmail,
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
    user: User | None = None,
    organization: Organization | None = None,
    customer_id: str = "CUSTOMER_ID",
    product_id: str = "PRODUCT_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    metadata: dict[str, str] = {},
) -> stripe_lib.Subscription:
    now_timestamp = datetime.now(UTC).timestamp()
    base_metadata: dict[str, str] = {
        **({"user_id": str(user.id)} if user is not None else {}),
        **(
            {"organization_subscriber_id": str(organization.id)}
            if organization is not None
            else {}
        ),
    }
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
            "metadata": {**base_metadata, **metadata},
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
    subscription_id: str = "SUBSCRIPTION_ID",
    metadata: dict[str, str] = {},
) -> stripe_lib.Invoice:
    return stripe_lib.Invoice.construct_from(
        {
            "id": id,
            "total": total,
            "tax": tax,
            "currency": "usd",
            "charge": charge_id,
            "subscription": subscription_id,
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
class TestCreateFreeSubscription:
    async def test_not_existing_subscription_tier(
        self,
        session: AsyncSession,
        user: User,
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=uuid.uuid4(), customer_email=None
                ),
                auth_subject=user,
                auth_method=AuthMethod.COOKIE,
            )

    async def test_not_free_subscription_tier(
        self,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        with pytest.raises(NotAFreeSubscriptionTier):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_organization.id, customer_email=None
                ),
                auth_subject=user,
                auth_method=AuthMethod.COOKIE,
            )

    async def test_already_subscribed_email(
        self,
        session: AsyncSession,
        subscription_tier_organization_free: SubscriptionTier,
        user: User,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization_free,
            user=user,
            stripe_subscription_id=None,
        )

        with pytest.raises(AlreadySubscribed):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_organization_free.id,
                    customer_email=EmailStr(user.email),
                ),
                auth_subject=Anonymous(),
                auth_method=None,
            )

    async def test_already_subscribed_user(
        self,
        session: AsyncSession,
        subscription_tier_organization_free: SubscriptionTier,
        user: User,
    ) -> None:
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization_free,
            user=user,
            stripe_subscription_id=None,
        )

        with pytest.raises(AlreadySubscribed):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_organization_free.id, customer_email=None
                ),
                auth_subject=user,
                auth_method=AuthMethod.COOKIE,
            )

    async def test_new_user_no_customer_email(
        self,
        session: AsyncSession,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        with pytest.raises(RequiredCustomerEmail):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_organization_free.id, customer_email=None
                ),
                auth_subject=Anonymous(),
                auth_method=None,
            )

    async def test_new_user(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription = await subscription_service.create_free_subscription(
            session,
            free_subscription_create=FreeSubscriptionCreate(
                tier_id=subscription_tier_organization_free.id,
                customer_email=EmailStr("backer@example.com"),
            ),
            auth_subject=Anonymous(),
            auth_method=None,
        )

        assert (
            subscription.subscription_tier_id == subscription_tier_organization_free.id
        )
        assert subscription.user.email == "backer@example.com"

        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )

    async def test_authenticated_user(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization_free: SubscriptionTier,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription = await subscription_service.create_free_subscription(
            session,
            free_subscription_create=FreeSubscriptionCreate(
                tier_id=subscription_tier_organization_free.id, customer_email=None
            ),
            auth_subject=user,
            auth_method=AuthMethod.COOKIE,
        )

        assert (
            subscription.subscription_tier_id == subscription_tier_organization_free.id
        )
        assert subscription.user_id == user.id

        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
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
        stripe_service_mock: MagicMock,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user, product_id=subscription_tier_organization.stripe_product_id
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        assert subscription.user_id == user.id

        await session.refresh(user)
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_set_started_at(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            product_id=subscription_tier_organization.stripe_product_id,
            status=SubscriptionStatus.active,
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.started_at is not None

        await session.refresh(user)
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_subscription_upgrade(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        subscription_tier_organization_free: SubscriptionTier,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        existing_subscription = await create_active_subscription(
            session, subscription_tier=subscription_tier_organization_free, user=user
        )

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            product_id=subscription_tier_organization.stripe_product_id,
            status=SubscriptionStatus.active,
            metadata={"subscription_id": str(existing_subscription.id)},
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.id == existing_subscription.id
        assert subscription.subscription_tier_id == subscription_tier_organization.id
        assert subscription.started_at == existing_subscription.started_at

        await session.refresh(user)
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_organization(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        subscription_tier_organization: SubscriptionTier,
        user: User,
        organization: Organization,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert subscription_tier_organization.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            organization=organization,
            product_id=subscription_tier_organization.stripe_product_id,
        )

        subscription = await subscription_service.create_subscription(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.subscription_tier_id == subscription_tier_organization.id

        assert subscription.user_id == user.id
        assert subscription.organization_id == organization.id

        await session.refresh(user)
        assert user.stripe_customer_id is None

        await session.refresh(organization)
        assert organization.stripe_customer_id == stripe_subscription.customer
        assert organization.billing_email == stripe_customer.email


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


@pytest.mark.asyncio
class TestTransferSubscriptionPaidInvoice:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        stripe_invoice = construct_stripe_invoice()
        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.transfer_subscription_paid_invoice(
                session, invoice=stripe_invoice
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription: Subscription,
        organization_account: Account,
    ) -> None:
        stripe_invoice = construct_stripe_invoice(
            subscription_id=subscription.stripe_subscription_id
        )

        stripe_service_mock = mocker.patch(
            "polar.subscription.service.subscription.stripe_service", spec=StripeService
        )

        transaction_service_mock = mocker.patch(
            "polar.subscription.service.subscription.transfer_transaction_service",
            spec=TransferTransactionService,
        )
        transaction_service_mock.create_transfer_from_charge.return_value = (
            Transaction(transfer_id="STRIPE_TRANSFER_ID"),
            Transaction(transfer_id="STRIPE_TRANSFER_ID"),
        )

        await subscription_service.transfer_subscription_paid_invoice(
            session, invoice=stripe_invoice
        )

        transaction_service_mock.create_transfer_from_charge.assert_called_once()
        assert (
            transaction_service_mock.create_transfer_from_charge.call_args[1][
                "destination_account"
            ].id
            == organization_account.id
        )
        assert (
            transaction_service_mock.create_transfer_from_charge.call_args[1][
                "charge_id"
            ]
            == stripe_invoice.charge
        )
        assert (
            transaction_service_mock.create_transfer_from_charge.call_args[1]["amount"]
            == 9000
        )

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
                    user_id=subscription.user_id,
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
                    user_id=subscription.user_id,
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
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        grant = SubscriptionBenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
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
            user_id=subscription.user_id,
            subscription_benefit_id=subscription_benefits[0].id,
        )

    async def test_subscription_organization(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
        subscription_organization: Subscription,
        organization_subscriber_admin: User,
        organization_subscriber_members: list[User],
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        subscription_tier_organization = await add_subscription_benefits(
            session,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )
        subscription_organization.status = SubscriptionStatus.active

        await subscription_service.enqueue_benefits_grants(
            session, subscription_organization
        )

        members_count = len(organization_subscriber_members) + 1  # Members + admin
        benefits_count = len(subscription_benefits) + 1  # Benefits + articles
        assert enqueue_job_mock.call_count == members_count * benefits_count

        for user_id in [
            organization_subscriber_admin.id,
            *[member.id for member in organization_subscriber_members],
        ]:
            enqueue_job_mock.assert_has_awaits(
                [
                    call(
                        "subscription.subscription_benefit.grant",
                        subscription_id=subscription_organization.id,
                        user_id=user_id,
                        subscription_benefit_id=benefit.id,
                    )
                    for benefit in subscription_benefits
                ]
            )


@pytest.mark.asyncio
class TestUpdateSubscriptionTierBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        user: User,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )
        subscription_1 = await create_subscription(
            session, subscription_tier=subscription_tier_organization, user=user
        )
        subscription_2 = await create_subscription(
            session, subscription_tier=subscription_tier_organization, user=user
        )
        await create_subscription(
            session, subscription_tier=subscription_tier_organization_second, user=user
        )

        await subscription_service.update_subscription_tier_benefits_grants(
            session, subscription_tier_organization
        )

        assert enqueue_job_mock.call_count == 2

        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_1.id,
        )
        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_2.id,
        )


@pytest.mark.asyncio
class TestUpdateOrganizationBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        user: User,
        organization_subscriber: Organization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )
        subscription_1 = await create_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            organization=organization_subscriber,
        )
        subscription_2 = await create_subscription(
            session,
            subscription_tier=subscription_tier_organization_second,
            user=user,
            organization=organization_subscriber,
        )
        await create_subscription(
            session, subscription_tier=subscription_tier_organization, user=user
        )

        await subscription_service.update_organization_benefits_grants(
            session, organization_subscriber
        )

        assert enqueue_job_mock.call_count == 2

        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_1.id,
        )
        enqueue_job_mock.assert_any_await(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_2.id,
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

    async def test_free_subscription(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier_organization_free: SubscriptionTier,
        user: User,
    ) -> None:
        subscription = await create_subscription(
            session, subscription_tier=subscription_tier_organization_free, user=user
        )
        with pytest.raises(FreeSubscriptionUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4()
                ),
                authz=authz,
                user=user,
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
class TestCancelSubscription:
    async def test_not_permitted(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        user_second: User,
    ) -> None:
        with pytest.raises(NotPermitted):
            await subscription_service.cancel_subscription(
                session, subscription=subscription, authz=authz, user=user_second
            )

    async def test_already_canceled(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        subscription = await create_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            status=SubscriptionStatus.canceled,
        )
        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel_subscription(
                session, subscription=subscription, authz=authz, user=user
            )

    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            session, subscription_tier=subscription_tier_organization, user=user
        )
        subscription.cancel_at_period_end = True

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel_subscription(
                session, subscription=subscription, authz=authz, user=user
            )

    async def test_free_subscription(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
            stripe_subscription_id=None,
        )

        updated_subscription = await subscription_service.cancel_subscription(
            session, subscription=subscription, authz=authz, user=user
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ended_at is not None

        stripe_service_mock.cancel_subscription.assert_not_called()

    async def test_stripe_subscription(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        authz: Authz,
        subscription_tier_organization: SubscriptionTier,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user,
        )

        updated_subscription = await subscription_service.cancel_subscription(
            session, subscription=subscription, authz=authz, user=user
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None

        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id
        )


def get_net_amount(gross_amount: int) -> int:
    return int(gross_amount * (1 - settings.SUBSCRIPTION_FEE_PERCENT / 100))


def get_transfers_sum(transfers: list[Transaction]) -> int:
    return sum(transfer.amount for transfer in transfers)


async def create_subscription_transfers(
    session: AsyncSession,
    *,
    gross_amount: int,
    start_month: int,
    end_month: int,
    organization_account: Account,
    subscription: Subscription,
    year: int = 2023,
) -> list[Transaction]:
    net_amount = get_net_amount(gross_amount)
    transactions: list[Transaction] = []
    for month in range(start_month, end_month + 1):
        transaction = Transaction(
            created_at=datetime(year, month, 1, 0, 0, 0, 0, UTC),
            type=TransactionType.transfer,
            processor=PaymentProcessor.stripe,
            currency="usd",
            amount=net_amount,
            account_currency="eur",
            account_amount=int(net_amount * 0.9),
            tax_amount=0,
            processor_fee_amount=0,
            account=organization_account,
            subscription=subscription,
        )
        session.add(transaction)
        transactions.append(transaction)
    await session.commit()
    return transactions


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
            current_start_of_month=date(2023, 10, 1),
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
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(transfers[0 : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == get_transfers_sum(transfers)

    async def test_multiple_users_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_account: Account,
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

        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(transfers[0 : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == get_transfers_sum(transfers)

    async def test_filter_indirect_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        subscription_organization = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_organization = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_organization,
        )
        subscription_repository = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_repository = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_repository,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            direct_organization=False,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 2
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
                + subscription_tier_repository.price_amount
            )
            assert result.cumulative == get_transfers_sum(
                transfers_organization[0 : i + 1] + transfers_repository[0 : i + 1]
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == get_transfers_sum(
                transfers_organization + transfers_repository
            )

    async def test_filter_repository(
        self,
        session: AsyncSession,
        public_repository: Repository,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        subscription_organization = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_organization = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_organization,
        )
        subscription_repository = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_repository = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_repository,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            repository=public_repository,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.mrr == get_net_amount(
                subscription_tier_repository.price_amount
            )
            assert result.cumulative == get_transfers_sum(
                transfers_repository[0 : i + 1]
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == get_transfers_sum(transfers_repository)

    async def test_filter_type(
        self,
        session: AsyncSession,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            types=[SubscriptionTierType.business],
        )

        assert len(results) == 12

        for result in results:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == 0

    async def test_filter_subscription_tier_id(
        self,
        session: AsyncSession,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_repository: SubscriptionTier,
    ) -> None:
        subscription_organization = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_organization = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_organization,
        )
        subscription_repository = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_repository,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        transfers_repository = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_repository,
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
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(
                transfers_organization[0 : i + 1]
            )

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.mrr == 0
            assert result.cumulative == get_transfers_sum(transfers_organization)

    async def test_ongoing_subscription(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
        )
        transfers = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=10,
            organization_account=organization_account,
            subscription=subscription,
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:9]):
            assert result.subscribers == 1
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(transfers[0 : i + 1])

        for i, result in enumerate(results[9:]):
            assert result.subscribers == 1
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(
                transfers[:-1]
            ) + get_net_amount(subscription_tier_organization.price_amount) * (i + 1)

    async def test_free_subscription(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        subscription = await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization,
            user=user_second,
            started_at=datetime(2023, 1, 1),
        )
        transfers = await create_subscription_transfers(
            session,
            gross_amount=subscription_tier_organization.price_amount,
            start_month=1,
            end_month=10,
            organization_account=organization_account,
            subscription=subscription,
        )
        await create_active_subscription(
            session,
            subscription_tier=subscription_tier_organization_free,
            user=user_second,
            started_at=datetime(2023, 1, 1),
        )

        results = await subscription_service.get_statistics_periods(
            session,
            user,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
            current_start_of_month=date(2023, 10, 1),
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:9]):
            assert result.subscribers == 2
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(transfers[0 : i + 1])

        for i, result in enumerate(results[9:]):
            assert result.subscribers == 2
            assert result.mrr == get_net_amount(
                subscription_tier_organization.price_amount
            )
            assert result.cumulative == get_transfers_sum(
                transfers[:-1]
            ) + get_net_amount(subscription_tier_organization.price_amount) * (i + 1)
