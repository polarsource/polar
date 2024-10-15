import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.pagination import PaginationParams
from polar.models import Organization, Product, ProductPriceFixed, Subscription, User
from polar.models.product_price import ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.user.schemas.subscription import (
    UserSubscriptionUpdate,
)
from polar.user.service.subscription import (
    AlreadyCanceledSubscription,
    SubscriptionNotActiveOnStripe,
)
from polar.user.service.subscription import (
    user_subscription as user_subscription_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
    create_product_price_fixed,
    create_subscription,
)


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.user.service.subscription.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth
    async def test_valid(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        user_second: User,
        product: Product,
        product_second: Product,
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
            product=product_second,
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

        results, count = await user_subscription_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 2
        assert count == 2


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdate:
    async def test_not_existing_product(
        self, session: AsyncSession, subscription: Subscription
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await user_subscription_service.update(
                session,
                subscription=subscription,
                subscription_update=UserSubscriptionUpdate(
                    product_price_id=uuid.uuid4()
                ),
            )

    async def test_not_recurring_price(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        product = await create_product(save_fixture, organization=organization)
        price = await create_product_price_fixed(
            save_fixture, product=product, type=ProductPriceType.one_time
        )
        with pytest.raises(PolarRequestValidationError):
            await user_subscription_service.update(
                session,
                subscription=subscription,
                subscription_update=UserSubscriptionUpdate(product_price_id=price.id),
            )

    async def test_extraneous_tier(
        self,
        session: AsyncSession,
        subscription: Subscription,
        product_organization_second: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await user_subscription_service.update(
                session,
                subscription=subscription,
                subscription_update=UserSubscriptionUpdate(
                    product_price_id=product_organization_second.all_prices[0].id
                ),
            )

    async def test_not_existing_stripe_subscription(
        self, session: AsyncSession, subscription: Subscription, product_second: Product
    ) -> None:
        subscription.stripe_subscription_id = None
        with pytest.raises(SubscriptionNotActiveOnStripe):
            await user_subscription_service.update(
                session,
                subscription=subscription,
                subscription_update=UserSubscriptionUpdate(
                    product_price_id=product_second.prices[0].id
                ),
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
        updated_subscription = await user_subscription_service.update(
            session,
            subscription=subscription,
            subscription_update=UserSubscriptionUpdate(
                product_price_id=product_second.prices[0].id,
            ),
        )

        assert isinstance(new_price, ProductPriceFixed)
        assert updated_subscription.product == product_second
        assert updated_subscription.price == new_price
        assert updated_subscription.amount == new_price.price_amount
        assert updated_subscription.recurring_interval == new_price.recurring_interval

        stripe_service_mock.update_subscription_price.assert_called_once_with(
            subscription.stripe_subscription_id,
            old_price=product.prices[0].stripe_price_id,
            new_price=product_second.prices[0].stripe_price_id,
        )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCancel:
    @pytest.mark.auth
    async def test_already_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
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

        with pytest.raises(AlreadyCanceledSubscription):
            await user_subscription_service.cancel(session, subscription=subscription)

    @pytest.mark.auth
    async def test_cancel_at_period_end(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        subscription: Subscription,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, user=user
        )
        subscription.cancel_at_period_end = True
        await save_fixture(subscription)

        with pytest.raises(AlreadyCanceledSubscription):
            await user_subscription_service.cancel(session, subscription=subscription)

    @pytest.mark.auth
    async def test_free_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
            stripe_subscription_id=None,
        )

        updated_subscription = await user_subscription_service.cancel(
            session, subscription=subscription
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.cancel_at_period_end is True
        assert updated_subscription.ended_at is not None

        stripe_service_mock.cancel_subscription.assert_not_called()

    @pytest.mark.auth
    async def test_stripe_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        stripe_service_mock: MagicMock,
        product: Product,
        user: User,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            user=user,
        )

        updated_subscription = await user_subscription_service.cancel(
            session, subscription=subscription
        )

        assert updated_subscription.id == subscription.id
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None

        stripe_service_mock.cancel_subscription.assert_called_once_with(
            subscription.stripe_subscription_id
        )
