import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.models.order_item import OrderItem
from polar.models.organization import Organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_product,
    create_product_price_custom,
    create_product_price_fixed,
    create_product_price_free,
    create_product_price_seat_unit,
)


@pytest.mark.asyncio
class TestOrderItemFromPrice:
    async def test_from_price_fixed(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with fixed price."""
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None, prices=[]
        )
        price = await create_product_price_fixed(
            save_fixture, product=product, amount=5000
        )

        order_item = OrderItem.from_price(price, tax_amount=0)

        assert order_item.label == product.name
        assert order_item.amount == 5000
        assert order_item.tax_amount == 0
        assert order_item.quantity == 1  # Default quantity for fixed price
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_custom(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with custom price."""
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None, prices=[]
        )
        price = await create_product_price_custom(save_fixture, product=product)

        order_item = OrderItem.from_price(price, tax_amount=100, amount=7500)

        assert order_item.label == product.name
        assert order_item.amount == 7500  # Custom amount provided
        assert order_item.tax_amount == 100
        assert order_item.quantity == 1  # Default quantity for custom price
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_free(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with free price."""
        product = await create_product(
            save_fixture, organization=organization, recurring_interval=None, prices=[]
        )
        price = await create_product_price_free(save_fixture, product=product)

        order_item = OrderItem.from_price(price, tax_amount=0)

        assert order_item.label == product.name
        assert order_item.amount == 0  # Free price
        assert order_item.tax_amount == 0
        assert order_item.quantity == 1  # Default quantity for free price
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_seat_based(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with seat-based price."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=1000  # $10 per seat
        )

        # Create order item with 5 seats
        order_item = OrderItem.from_price(price, tax_amount=250, seats=5)

        assert order_item.label == product.name
        assert order_item.amount == 5000  # 5 seats × $10 = $50
        assert order_item.tax_amount == 250
        assert order_item.quantity == 5  # Quantity should equal seats
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_seat_based_single_seat(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with seat-based price and 1 seat."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=2500  # $25 per seat
        )

        # Create order item with 1 seat
        order_item = OrderItem.from_price(price, tax_amount=0, seats=1)

        assert order_item.label == product.name
        assert order_item.amount == 2500  # 1 seat × $25 = $25
        assert order_item.tax_amount == 0
        assert order_item.quantity == 1  # Quantity should equal 1
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_seat_based_large_quantity(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with seat-based price and many seats."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=999  # $9.99 per seat
        )

        # Create order item with 100 seats
        order_item = OrderItem.from_price(price, tax_amount=5000, seats=100)

        assert order_item.label == product.name
        assert order_item.amount == 99900  # 100 seats × $9.99 = $999.00
        assert order_item.tax_amount == 5000
        assert order_item.quantity == 100  # Quantity should equal 100
        assert order_item.product_price == price
        assert order_item.proration is False

    async def test_from_price_seat_based_without_seats_raises(
        self, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        """Test OrderItem.from_price() with seat-based price but no seats provided."""
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_seat_unit(
            save_fixture, product=product, price_per_seat=1000
        )

        # Should raise assertion error when seats not provided
        with pytest.raises(AssertionError, match="seats must be provided"):
            OrderItem.from_price(price, tax_amount=0)
