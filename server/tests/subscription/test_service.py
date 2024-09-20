from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, call

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.authz.service import Authz
from polar.kit.pagination import PaginationParams
from polar.models import (
    Benefit,
    Organization,
    Product,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.product_price import ProductPriceCustom, ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.service import (
    AssociatedSubscriptionTierPriceDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.subscription.service import subscription as subscription_service
from polar.user.service.user import user as user_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_product_benefits,
    create_active_subscription,
    create_subscription,
)


def construct_stripe_subscription(
    *,
    user: User | None = None,
    organization: Organization | None = None,
    customer_id: str = "CUSTOMER_ID",
    price_id: str = "PRICE_ID",
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    latest_invoice: stripe_lib.Invoice | None = None,
    cancel_at_period_end: bool = False,
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
            "cancel_at_period_end": cancel_at_period_end,
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
class TestCreateArbitrarySubscription:
    async def test_valid_fixed_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        product: Product,
        user: User,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        # then
        session.expunge_all()

        price = product.prices[0]
        assert isinstance(price, ProductPriceFixed)
        subscription = await subscription_service.create_arbitrary_subscription(
            session, user=user, product=product, price=price
        )

        assert subscription.product_id == product.id
        assert subscription.user_id == user.id
        assert subscription.amount == price.price_amount
        assert subscription.currency == price.price_currency
        assert subscription.recurring_interval == price.recurring_interval

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_custom_price(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        product_recurring_custom_price: Product,
        user: User,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        # then
        session.expunge_all()

        price = product_recurring_custom_price.prices[0]
        assert isinstance(price, ProductPriceCustom)
        subscription = await subscription_service.create_arbitrary_subscription(
            session,
            user=user,
            product=product_recurring_custom_price,
            price=price,
            amount=2000,
        )

        assert subscription.product_id == product_recurring_custom_price.id
        assert subscription.user_id == user.id
        assert subscription.amount == 2000
        assert subscription.currency == price.price_currency
        assert subscription.recurring_interval == price.recurring_interval

        enqueue_benefits_grants_mock.assert_called_once()


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
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
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

        enqueue_benefits_grants_mock.assert_called_once()

    async def test_valid_cancel_at_period_end(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        user: User,
    ) -> None:
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
        )

        price = product.prices[0]
        stripe_subscription = construct_stripe_subscription(
            status=SubscriptionStatus.active,
            price_id=price.stripe_price_id,
            cancel_at_period_end=True,
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
        assert updated_subscription.cancel_at_period_end is True

        enqueue_benefits_grants_mock.assert_called_once()


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
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

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
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

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
                    "benefit.enqueue_benefits_grants",
                    task="grant",
                    user_id=subscription.user_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
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
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")

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
                    "benefit.enqueue_benefits_grants",
                    task="revoke",
                    user_id=subscription.user_id,
                    product_id=product.id,
                    subscription_id=subscription.id,
                )
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
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service, "enqueue_benefits_grants"
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

        assert enqueue_benefits_grants_mock.call_count == 2
        assert enqueue_benefits_grants_mock.call_args_list[0].args[1] == subscription_1
        assert enqueue_benefits_grants_mock.call_args_list[1].args[1] == subscription_2


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
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

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 0
        assert count == 0

    @pytest.mark.auth
    async def test_user_organization_member(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
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

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
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

        results, count = await subscription_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1
