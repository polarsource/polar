import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import (
    Checkout,
    Customer,
    Order,
    Organization,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.customer_seat import CustomerSeat, SeatStatus
from polar.models.order import OrderStatus
from polar.models.subscription import SubscriptionStatus
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_customer_seat,
    create_order_with_seats,
    create_product,
    create_product_price_seat_unit,
    create_subscription_with_seats,
)


@pytest_asyncio.fixture
async def seat_enabled_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Organization:
    organization.feature_settings = {
        **organization.feature_settings,
        "seat_based_pricing_enabled": True,
    }
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture
async def subscription_with_seats(
    save_fixture: SaveFixture,
    seat_enabled_organization: Organization,
    customer: Customer,
) -> Subscription:
    product = await create_product(
        save_fixture,
        organization=seat_enabled_organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],  # Empty prices, we'll add seat-based price manually
    )

    # Add seat-based pricing to the product
    await create_product_price_seat_unit(
        save_fixture, product=product, price_per_seat=1000
    )

    return await create_subscription_with_seats(
        save_fixture,
        product=product,
        customer=customer,
        seats=5,
        status=SubscriptionStatus.active,
        started_at=utc_now(),
    )


@pytest_asyncio.fixture
async def user_organization_seat_enabled(
    save_fixture: SaveFixture,
    seat_enabled_organization: Organization,
    user: User,
) -> UserOrganization:
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=seat_enabled_organization.id,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture
async def customer_seat_pending(
    save_fixture: SaveFixture,
    subscription_with_seats: Subscription,
    session: AsyncSession,
) -> CustomerSeat:
    seat = await create_customer_seat(
        save_fixture, subscription=subscription_with_seats
    )
    await session.refresh(seat, ["subscription"])
    assert seat.subscription is not None
    await session.refresh(seat.subscription, ["product"])
    assert seat.subscription is not None
    await session.refresh(seat.subscription.product, ["organization"])
    return seat


@pytest_asyncio.fixture
async def customer_seat_claimed(
    save_fixture: SaveFixture,
    subscription_with_seats: Subscription,
    customer: Customer,
    session: AsyncSession,
) -> CustomerSeat:
    seat = await create_customer_seat(
        save_fixture,
        subscription=subscription_with_seats,
        customer=customer,
        status=SeatStatus.claimed,
        claimed_at=utc_now(),
    )
    await session.refresh(seat, ["subscription"])
    assert seat.subscription is not None
    await session.refresh(seat.subscription, ["product"])
    assert seat.subscription is not None
    await session.refresh(seat.subscription.product, ["organization"])
    return seat


@pytest_asyncio.fixture
async def order_with_seats(
    save_fixture: SaveFixture,
    seat_enabled_organization: Organization,
    customer: Customer,
) -> Order:
    product = await create_product(
        save_fixture,
        organization=seat_enabled_organization,
        recurring_interval=None,  # One-time purchase
        prices=[],
    )

    await create_product_price_seat_unit(
        save_fixture, product=product, price_per_seat=1000
    )

    order = await create_order_with_seats(
        save_fixture,
        product=product,
        customer=customer,
        seats=5,
        status=OrderStatus.paid,
    )
    return order


@pytest_asyncio.fixture
async def checkout_with_order(
    save_fixture: SaveFixture,
    order_with_seats: Order,
    session: AsyncSession,
) -> Checkout:
    # Refresh product to load prices
    await session.refresh(order_with_seats.product, ["prices"])

    assert order_with_seats.product is not None
    checkout = await create_checkout(
        save_fixture,
        products=[order_with_seats.product],
        customer=order_with_seats.customer,
    )
    # Link order to checkout
    order_with_seats.checkout_id = checkout.id
    await save_fixture(order_with_seats)
    return checkout


@pytest_asyncio.fixture
async def customer_seat_order_pending(
    save_fixture: SaveFixture,
    order_with_seats: Order,
    session: AsyncSession,
) -> CustomerSeat:
    seat = await create_customer_seat(save_fixture, order=order_with_seats)
    await session.refresh(seat, ["order"])
    assert seat.order is not None
    await session.refresh(seat.order, ["product"])
    assert seat.order is not None
    await session.refresh(seat.order.product, ["organization"])
    return seat
