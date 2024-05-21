import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import Anonymous, AuthSubject
from polar.authz.service import Authz
from polar.config import settings
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.models import (
    Account,
    Benefit,
    BenefitGrant,
    Organization,
    Product,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.product import SubscriptionTierType
from polar.models.product_price import ProductPriceRecurringInterval
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.subscription.schemas import FreeSubscriptionCreate, SubscriptionUpgrade
from polar.subscription.service.subscription import (
    AlreadyCanceledSubscription,
    AlreadySubscribed,
    AssociatedSubscriptionTierPriceDoesNotExist,
    FreeSubscriptionUpgrade,
    InvalidSubscriptionTierUpgrade,
    NotAFreeSubscriptionTier,
    RequiredCustomerEmail,
    SubscriptionDoesNotExist,
)
from polar.subscription.service.subscription import subscription as subscription_service
from polar.user.service import user as user_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_product_benefits,
    create_active_subscription,
    create_product_price,
    create_sale,
    create_subscription,
    create_user,
)


def construct_stripe_subscription(
    *,
    user: User | None = None,
    organization: Organization | None = None,
    customer_id: str = "CUSTOMER_ID",
    price_id: str = "PRICE_ID",
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
                    {"price": {"id": price_id, "currency": "USD", "unit_amount": 1000}}
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


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestCreateFreeSubscription:
    @pytest.mark.auth
    async def test_not_existing_subscription_tier(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(ResourceNotFound):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=uuid.uuid4(), customer_email=None
                ),
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_not_free_subscription_tier(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(NotAFreeSubscriptionTier):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=product.id, customer_email=None
                ),
                auth_subject=auth_subject,
            )

    async def test_already_subscribed_email(
        self,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
            stripe_subscription_id=None,
        )

        # then
        session.expunge_all()

        with pytest.raises(AlreadySubscribed):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_free.id,
                    customer_email=user.email,
                ),
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_already_subscribed_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
            stripe_subscription_id=None,
        )

        # then
        session.expunge_all()

        with pytest.raises(AlreadySubscribed):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_free.id, customer_email=None
                ),
                auth_subject=auth_subject,
            )

    async def test_new_user_no_customer_email(
        self,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        subscription_tier_free: Product,
    ) -> None:
        # then
        session.expunge_all()

        with pytest.raises(RequiredCustomerEmail):
            await subscription_service.create_free_subscription(
                session,
                free_subscription_create=FreeSubscriptionCreate(
                    tier_id=subscription_tier_free.id, customer_email=None
                ),
                auth_subject=auth_subject,
            )

    async def test_new_user(
        self,
        auth_subject: AuthSubject[Anonymous],
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_free: Product,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_free_subscription(
            session,
            free_subscription_create=FreeSubscriptionCreate(
                tier_id=subscription_tier_free.id,
                customer_email="backer@example.com",
            ),
            auth_subject=auth_subject,
        )
        await session.flush()

        assert subscription.product_id == subscription_tier_free.id
        assert subscription.user.email == "backer@example.com"

        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )

    @pytest.mark.auth
    async def test_authenticated_user(
        self,
        auth_subject: AuthSubject[User],
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_free_subscription(
            session,
            free_subscription_create=FreeSubscriptionCreate(
                tier_id=subscription_tier_free.id, customer_email=None
            ),
            auth_subject=auth_subject,
        )
        await session.flush()

        assert subscription.product_id == subscription_tier_free.id
        assert subscription.user_id == user.id

        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )


@pytest.mark.asyncio
class TestCreateArbitrarySubscription:
    async def test_already_subscribed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
            stripe_subscription_id=None,
        )

        # then
        session.expunge_all()

        with pytest.raises(AlreadySubscribed):
            await subscription_service.create_arbitrary_subscription(
                session,
                user=user,
                product=subscription_tier_free,
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_arbitrary_subscription(
            session,
            user=user,
            product=subscription_tier_free,
        )

        assert subscription.product_id == subscription_tier_free.id
        assert subscription.user_id == user.id

        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants", subscription.id
        )


@pytest.mark.asyncio
class TestCreateSubscriptionFromStripe:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()

        # then
        session.expunge_all()

        with pytest.raises(AssociatedSubscriptionTierPriceDoesNotExist):
            await subscription_service.create_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_new_user(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert product.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            price_id=product.prices[0].stripe_price_id
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        user = await user_service.get(session, subscription.user_id)
        assert user is not None
        assert user.email == stripe_customer.email
        assert user.stripe_customer_id == stripe_subscription.customer

    async def test_existing_user(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert product.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user, price_id=product.prices[0].stripe_price_id
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        assert subscription.user_id == user.id

        # load user
        user_loaded = await user_service.get(session, user.id)
        assert user_loaded

        assert user_loaded.stripe_customer_id == stripe_subscription.customer

    async def test_set_started_at(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert product.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            price_id=product.prices[0].stripe_price_id,
            status=SubscriptionStatus.active,
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.started_at is not None

        # load user
        user_loaded = await user_service.get(session, user.id)
        assert user_loaded

        assert user_loaded.stripe_customer_id == stripe_subscription.customer

    async def test_subscription_upgrade(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        subscription_tier_free: Product,
        product: Product,
        user: User,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        existing_subscription = await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
        )

        assert product.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            price_id=product.prices[0].stripe_price_id,
            status=SubscriptionStatus.active,
            metadata={"subscription_id": str(existing_subscription.id)},
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.status == SubscriptionStatus.active
        assert subscription.id == existing_subscription.id
        assert subscription.product_id == product.id
        assert subscription.started_at == existing_subscription.started_at

        # load user
        user_loaded = await user_service.get(session, user.id)
        assert user_loaded

        assert user_loaded.stripe_customer_id == stripe_subscription.customer

    async def test_organization(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
        user: User,
        organization: Organization,
    ) -> None:
        stripe_customer = construct_stripe_customer()
        get_customer_mock = stripe_service_mock.get_customer
        get_customer_mock.return_value = stripe_customer

        assert product.stripe_product_id is not None
        stripe_subscription = construct_stripe_subscription(
            user=user,
            organization=organization,
            price_id=product.prices[0].stripe_price_id,
        )

        # then
        session.expunge_all()

        subscription = await subscription_service.create_subscription_from_stripe(
            session, stripe_subscription=stripe_subscription
        )

        assert subscription.stripe_subscription_id == stripe_subscription.id
        assert subscription.product_id == product.id

        assert subscription.user_id == user.id
        assert subscription.organization_id == organization.id

        # load user
        user_loaded = await user_service.get(session, user.id)
        assert user_loaded
        assert user_loaded.stripe_customer_id is None

        # load org
        organization_loaded = await organization_service.get(session, organization.id)
        assert organization_loaded

        assert organization_loaded.stripe_customer_id == stripe_subscription.customer
        assert organization_loaded.billing_email == stripe_customer.email


@pytest.mark.asyncio
class TestUpdateSubscriptionFromStripe:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        stripe_subscription = construct_stripe_subscription()

        # then
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_not_existing_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        user: User,
    ) -> None:
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active, price_id="NOT_EXISTING_PRICE_ID"
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            user=user,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        with pytest.raises(AssociatedSubscriptionTierPriceDoesNotExist):
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )

    async def test_valid(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active, price_id=price.stripe_price_id
        )
        subscription = await create_subscription(
            save_fixture,
            product=product,
            price=price,
            user=user,
            stripe_subscription_id=stripe_subscription.id,
        )
        assert subscription.started_at is None

        # then
        session.expunge_all()

        updated_subscription = (
            await subscription_service.update_subscription_from_stripe(
                session, stripe_subscription=stripe_subscription
            )
        )

        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.started_at is not None

        enqueue_job_mock.assert_any_call(
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
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

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
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.grant",
                    user_id=subscription.user_id,
                    benefit_id=benefit.id,
                    subscription_id=subscription.id,
                )
                for benefit in benefits
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
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription: Subscription,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription.status = status

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "benefit.revoke",
                    user_id=subscription.user_id,
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
        user: User,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        grant = BenefitGrant(
            subscription_id=subscription.id,
            user_id=user.id,
            benefit_id=benefits[0].id,
        )
        grant.set_granted()
        await save_fixture(grant)

        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits[1:],
        )
        subscription.status = SubscriptionStatus.active

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(session, subscription)

        enqueue_job_mock.assert_any_call(
            "benefit.revoke",
            user_id=subscription.user_id,
            benefit_id=benefits[0].id,
            subscription_id=subscription.id,
        )

    async def test_subscription_organization(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        benefits: list[Benefit],
        subscription_organization: Subscription,
        organization_second_admin: User,
        organization_second_members: list[User],
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )

        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )
        subscription_organization.status = SubscriptionStatus.active

        # then
        session.expunge_all()

        await subscription_service.enqueue_benefits_grants(
            session, subscription_organization
        )

        members_count = len(organization_second_members) + 1  # Members + admin
        benefits_count = len(benefits) + 1  # Benefits + articles
        assert enqueue_job_mock.call_count == members_count * benefits_count

        for benefit in benefits:
            enqueue_job_mock.assert_has_calls(
                [
                    call(
                        "benefit.grant",
                        user_id=user_id,
                        benefit_id=benefit.id,
                        subscription_id=subscription_organization.id,
                    )
                    for user_id in [
                        organization_second_admin.id,
                        *[member.id for member in organization_second_members],
                    ]
                ]
            )


@pytest.mark.asyncio
class TestUpdateProductBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user: User,
        product: Product,
        product_second: Product,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )
        subscription_1 = await create_subscription(
            save_fixture, product=product, user=user
        )
        subscription_2 = await create_subscription(
            save_fixture, product=product, user=user
        )
        await create_subscription(
            save_fixture,
            product=product_second,
            user=user,
        )

        # then
        session.expunge_all()

        await subscription_service.update_product_benefits_grants(session, product)

        assert enqueue_job_mock.call_count == 2

        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_1.id,
        )
        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_2.id,
        )


@pytest.mark.asyncio
class TestUpdateOrganizationBenefitsGrants:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user: User,
        organization_second: Organization,
        product: Product,
        product_second: Product,
    ) -> None:
        enqueue_job_mock = mocker.patch(
            "polar.subscription.service.subscription.enqueue_job"
        )
        subscription_1 = await create_subscription(
            save_fixture,
            product=product,
            user=user,
            organization=organization_second,
        )
        subscription_2 = await create_subscription(
            save_fixture,
            product=product_second,
            user=user,
            organization=organization_second,
        )
        await create_subscription(save_fixture, product=product, user=user)

        # then
        session.expunge_all()

        await subscription_service.update_organization_benefits_grants(
            session, organization_second
        )

        assert enqueue_job_mock.call_count == 2

        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_1.id,
        )
        enqueue_job_mock.assert_any_call(
            "subscription.subscription.enqueue_benefits_grants",
            subscription_2.id,
        )


@pytest.mark.asyncio
class TestSearch:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_user_own_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
        product: Product,
    ) -> None:
        """
        Checks that own subscriptions are not returned by this method.

        This is the role of `.search_subscribed`.
        """
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.search(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 0
        assert count == 0

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.search(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 0
        assert count == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.search(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_second: User,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.search(
            session,
            auth_subject,
            organization=organization,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1


@pytest.mark.asyncio
class TestSearchSubscribed:
    @pytest.mark.auth
    async def test_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results, count = await subscription_service.search_subscribed(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1


@pytest.mark.asyncio
class TestUpgradeSubscription:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_not_permitted(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(NotPermitted):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription_loaded,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4(), price_id=uuid.uuid4()
                ),
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_free_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        subscription_tier_free: Product,
        user: User,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
        )

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(FreeSubscriptionUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription_loaded,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4(), price_id=uuid.uuid4()
                ),
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_not_existing_tier(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(InvalidSubscriptionTierUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription_loaded,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=uuid.uuid4(), price_id=uuid.uuid4()
                ),
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_extraneous_tier(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        product_organization_second: Product,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(InvalidSubscriptionTierUpgrade):
            await subscription_service.upgrade_subscription(
                session,
                subscription=subscription_loaded,
                subscription_upgrade=SubscriptionUpgrade(
                    subscription_tier_id=product_organization_second.id,
                    price_id=product_organization_second.prices[0].id,
                ),
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        authz: Authz,
        subscription: Subscription,
        product: Product,
        product_second: Product,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        updated_subscription = await subscription_service.upgrade_subscription(
            session,
            subscription=subscription_loaded,
            subscription_upgrade=SubscriptionUpgrade(
                subscription_tier_id=product_second.id,
                price_id=product_second.prices[0].id,
            ),
            authz=authz,
            auth_subject=auth_subject,
        )
        await session.flush()

        assert updated_subscription.product_id == product_second.id
        assert updated_subscription.price == product_second.prices[0]

        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            old_price=product.prices[0].stripe_price_id,
            new_price=product_second.prices[0].stripe_price_id,
        )


@pytest.mark.asyncio
class TestCancelSubscription:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_not_permitted(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        authz: Authz,
        subscription: Subscription,
        user_second: User,
    ) -> None:
        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(NotPermitted):
            await subscription_service.cancel_subscription(
                session,
                subscription=subscription_loaded,
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_already_canceled(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        subscription: Subscription,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            user=user,
            status=SubscriptionStatus.canceled,
        )

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel_subscription(
                session,
                subscription=subscription_loaded,
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_cancel_at_period_end(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        authz: Authz,
        subscription: Subscription,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, user=user
        )
        subscription.cancel_at_period_end = True
        await save_fixture(subscription)

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        with pytest.raises(AlreadyCanceledSubscription):
            await subscription_service.cancel_subscription(
                session,
                subscription=subscription_loaded,
                authz=authz,
                auth_subject=auth_subject,
            )

    @pytest.mark.auth
    async def test_free_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        authz: Authz,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            stripe_subscription_id=None,
        )

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        updated_subscription = await subscription_service.cancel_subscription(
            session,
            subscription=subscription_loaded,
            authz=authz,
            auth_subject=auth_subject,
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ended_at is not None

        stripe_service_mock.cancel_subscription.assert_not_called()

    @pytest.mark.auth
    async def test_stripe_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        authz: Authz,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
        )

        # then
        session.expunge_all()

        # load
        subscription_loaded = await subscription_service.get(session, subscription.id)
        assert subscription_loaded

        updated_subscription = await subscription_service.cancel_subscription(
            session,
            subscription=subscription_loaded,
            authz=authz,
            auth_subject=auth_subject,
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None

        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id
        )


def get_net_amount(gross_amount: int) -> int:
    return int(gross_amount * (1 - settings.SUBSCRIPTION_FEE_PERCENT / 100))


def get_balances_sum(balances: list[Transaction]) -> int:
    return sum(balance.amount for balance in balances)


async def create_sale_subscription_balances(
    save_fixture: SaveFixture,
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
        sale = await create_sale(
            save_fixture,
            user=subscription.user,
            product=subscription.product,
            subscription=subscription,
        )
        transaction = Transaction(
            created_at=datetime(year, month, 1, 0, 0, 0, 0, UTC),
            type=TransactionType.balance,
            processor=PaymentProcessor.stripe,
            currency="usd",
            amount=net_amount,
            account_currency="eur",
            account_amount=int(net_amount * 0.9),
            tax_amount=0,
            account=organization_account,
            sale=sale,
        )
        await save_fixture(transaction)
        transactions.append(transaction)
    return transactions


@pytest.mark.asyncio
class TestGetStatisticsPeriods:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_second: User,
        product: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for result in results:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price = product.prices[0].price_amount
        balances = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.earnings == get_balances_sum(balances[i : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user_second: User,
        product: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price = product.prices[0].price_amount
        balances = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.earnings == get_balances_sum(balances[i : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth
    async def test_user_multiple_users_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        user2 = await create_user(save_fixture)
        user2_organization = UserOrganization(
            user_id=user2.id,
            organization_id=organization.id,
        )
        await save_fixture(user2_organization)

        user3 = await create_user(save_fixture)
        user3_organization = UserOrganization(
            user_id=user3.id,
            organization_id=organization.id,
        )
        await save_fixture(user3_organization)

        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price = product.prices[0].price_amount
        balances = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.earnings == get_balances_sum(balances[i : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth
    async def test_filter_type(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price = product.prices[0].price_amount
        await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            types=[SubscriptionTierType.business],
        )

        assert len(results) == 12

        for result in results:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth
    async def test_filter_subscription_tier_id(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
        product_second: Product,
    ) -> None:
        subscription_organization = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price_organization = product.prices[0].price_amount
        balances_organization = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price_organization,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_organization,
        )
        subscription_organization_second = await create_active_subscription(
            save_fixture,
            product=product_second,
            user=user_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        price_organization_second = product_second.prices[0].price_amount
        balances_organization_second = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price_organization_second,
            start_month=1,
            end_month=6,
            organization_account=organization_account,
            subscription=subscription_organization_second,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            subscription_tier_id=product.id,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:6]):
            assert result.subscribers == 1
            assert result.earnings == get_balances_sum(balances_organization[i : i + 1])

        for result in results[6:]:
            assert result.subscribers == 0
            assert result.earnings == 0

    @pytest.mark.auth
    async def test_free_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
        subscription_tier_free: Product,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user_second,
            started_at=datetime(2023, 1, 1),
        )
        price = product.prices[0].price_amount
        balances = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price,
            start_month=1,
            end_month=12,
            organization_account=organization_account,
            subscription=subscription,
        )
        await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user,
            started_at=datetime(2023, 1, 1),
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results):
            assert result.subscribers == 2
            assert result.earnings == get_balances_sum(balances[i : i + 1])

    @pytest.mark.auth
    async def test_cancelled_subscriptions(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        subscription_tier_free: Product,
    ) -> None:
        await create_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user_second,
            started_at=datetime(2023, 1, 1, 0, 0, 0),
            ended_at=datetime(2023, 1, 1, 1, 0, 0),
        )
        await create_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user_second,
            started_at=datetime(2023, 1, 1, 2, 0, 0),
            ended_at=datetime(2023, 1, 1, 3, 0, 0),
        )
        await create_active_subscription(
            save_fixture,
            product=subscription_tier_free,
            user=user_second,
            started_at=datetime(2023, 1, 1, 4, 0, 0),
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 1, 31),
            organization=organization,
        )

        assert len(results) == 1

        result = results[0]
        assert result.subscribers == 1

    @pytest.mark.auth
    async def test_yearly_subscription(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_account: Account,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        price = await create_product_price(
            save_fixture,
            product=product,
            amount=12000,
            recurring_interval=ProductPriceRecurringInterval.year,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            price=price,
            user=user_second,
            started_at=datetime(2023, 1, 1, tzinfo=UTC),
        )
        balances = await create_sale_subscription_balances(
            save_fixture,
            gross_amount=price.price_amount,
            start_month=1,
            end_month=1,
            organization_account=organization_account,
            subscription=subscription,
        )

        # then
        session.expunge_all()

        results = await subscription_service.get_statistics_periods(
            session,
            auth_subject,
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            organization=organization,
        )

        assert len(results) == 12

        for i, result in enumerate(results[0:1]):
            assert result.subscribers == 1
            assert result.earnings == get_balances_sum(balances[i : i + 1])

        for i, result in enumerate(results[1:]):
            assert result.subscribers == 1
            assert result.earnings == 0
