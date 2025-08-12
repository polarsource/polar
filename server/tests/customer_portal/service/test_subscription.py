import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.customer_portal.schemas.subscription import CustomerSubscriptionUpdateProduct
from polar.customer_portal.service.subscription import UpdateSubscriptionNotAllowed
from polar.customer_portal.service.subscription import (
    customer_subscription as customer_subscription_service,
)
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.pagination import PaginationParams
from polar.models import (
    Customer,
    Organization,
    Product,
    ProductPriceFixed,
    Subscription,
)
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.postgres import AsyncSession
from polar.product.guard import is_static_price
from polar.subscription.service import (
    AlreadyCanceledSubscription,
    SubscriptionNotActiveOnStripe,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
    create_subscription,
)
from tests.fixtures.stripe import cloned_stripe_canceled_subscription


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.subscription.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_valid(
        self,
        auth_subject: AuthSubject[Customer],
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        customer_second: Customer,
        product: Product,
        product_second: Product,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            save_fixture,
            product=product_second,
            customer=customer,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )
        await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer_second,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        results, count = await customer_subscription_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 2
        assert count == 2


@pytest.mark.asyncio
class TestUpdate:
    async def test_not_existing_product(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=uuid.uuid4()),
            )

    async def test_not_recurring_product(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=product.id),
            )

    async def test_extraneous_tier(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product_organization_second: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(
                    product_id=product_organization_second.id
                ),
            )

    async def test_not_existing_stripe_subscription(
        self, session: AsyncSession, subscription: Subscription, product_second: Product
    ) -> None:
        subscription.stripe_subscription_id = None
        with pytest.raises(SubscriptionNotActiveOnStripe):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=product_second.id),
            )

    async def test_update_not_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        subscription: Subscription,
        product_second: Product,
        organization: Organization,
    ) -> None:
        organization.subscription_settings = {
            **organization.subscription_settings,
            "allow_customer_updates": False,
        }
        await save_fixture(organization)

        with pytest.raises(UpdateSubscriptionNotAllowed):
            await customer_subscription_service.update(
                session,
                subscription,
                updates=CustomerSubscriptionUpdateProduct(product_id=product_second.id),
            )

    async def test_valid(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        subscription: Subscription,
        product: Product,
        product_second: Product,
    ) -> None:
        new_price = product_second.prices[0]
        updated_subscription = await customer_subscription_service.update(
            session,
            subscription,
            updates=CustomerSubscriptionUpdateProduct(product_id=product_second.id),
        )

        assert isinstance(new_price, ProductPriceFixed)
        assert updated_subscription.product == product_second
        assert updated_subscription.prices == product_second.prices
        assert updated_subscription.amount == new_price.price_amount
        assert (
            updated_subscription.recurring_interval == product_second.recurring_interval
        )

        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            new_prices=[
                price.stripe_price_id
                for price in product_second.prices
                if is_static_price(price)
            ],
            proration_behavior="create_prorations",
            metadata={
                "type": "product",
                "product_id": str(product_second.id),
            },
        )


@pytest.mark.asyncio
class TestCancel:
    @pytest.mark.auth
    async def test_already_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )

        with pytest.raises(AlreadyCanceledSubscription):
            await customer_subscription_service.cancel(session, subscription)

    @pytest.mark.auth
    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        subscription.cancel_at_period_end = True
        await save_fixture(subscription)

        canceled = cloned_stripe_canceled_subscription(subscription)
        stripe_service_mock.cancel_subscription.return_value = canceled

        with pytest.raises(AlreadyCanceledSubscription):
            await customer_subscription_service.cancel(session, subscription)

    @pytest.mark.auth
    async def test_stripe_subscription_cancellation(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        canceled = cloned_stripe_canceled_subscription(subscription)
        stripe_service_mock.cancel_subscription.return_value = canceled
        updated_subscription = await customer_subscription_service.cancel(
            session,
            subscription,
            reason=CustomerCancellationReason.too_complex,
            comment="So many settings",
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None
        assert updated_subscription.cancel_at_period_end
        assert updated_subscription.ends_at == updated_subscription.current_period_end

        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id,
            customer_reason="too_complex",
            customer_comment="So many settings",
        )
