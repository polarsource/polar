import pytest

from polar.auth.models import AuthSubject
from polar.customer_portal.service.order import (
    CustomerOrderSortProperty,
)
from polar.customer_portal.service.order import customer_order as customer_order_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Organization, Product
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_product,
)


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer_second)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.parametrize(
        "sorting",
        [
            [("created_at", True)],
            [("amount", True)],
            [("organization", False)],
            [("product", False)],
            [("subscription", False)],
        ],
    )
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_sorting(
        self,
        sorting: list[Sorting[CustomerOrderSortProperty]],
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_order(save_fixture, product=product, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(orders) == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_filters_by_product_name(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        product_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Premium Subscription",
        )
        product_no_match = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Basic Plan",
        )
        await create_order(save_fixture, product=product_match, customer=customer)
        await create_order(save_fixture, product=product_no_match, customer=customer)

        orders, count = await customer_order_service.list(
            session, auth_subject, query="Premium", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert len(orders) == 1
        assert orders[0].product.name == "Premium Subscription"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_percent_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that % in query is treated as literal, not wildcard."""
        product_with_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="50% Off Deal",
        )
        product_without_percent = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Half Price Deal",
        )
        await create_order(
            save_fixture, product=product_with_percent, customer=customer
        )
        await create_order(
            save_fixture, product=product_without_percent, customer=customer
        )

        orders, count = await customer_order_service.list(
            session, auth_subject, query="50%", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert orders[0].product.name == "50% Off Deal"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_underscore_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that _ in query is treated as literal, not single-char wildcard."""
        product_with_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="Pro_Plan",
        )
        product_without_underscore = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            name="ProXPlan",
        )
        await create_order(
            save_fixture, product=product_with_underscore, customer=customer
        )
        await create_order(
            save_fixture, product=product_without_underscore, customer=customer
        )

        orders, count = await customer_order_service.list(
            session, auth_subject, query="Pro_Plan", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert orders[0].product.name == "Pro_Plan"


@pytest.mark.asyncio
class TestGetById:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_other_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer_second: Customer,
    ) -> None:
        order = await create_order(
            save_fixture, product=product, customer=customer_second
        )

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_customer(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)

        result = await customer_order_service.get_by_id(session, auth_subject, order.id)

        assert result is not None
        assert result.id == order.id
