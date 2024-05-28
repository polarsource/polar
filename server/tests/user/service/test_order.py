import pytest

from polar.auth.models import AuthSubject
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Product, User
from polar.user.service.order import SortProperty
from polar.user.service.order import user_order as user_order_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestList:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        await create_order(save_fixture, product=product, user=user_second)

        orders, count = await user_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 0
        assert len(orders) == 0

    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user: User,
    ) -> None:
        await create_order(save_fixture, product=product, user=user)

        orders, count = await user_order_service.list(
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
    @pytest.mark.auth
    async def test_sorting(
        self,
        sorting: list[Sorting[SortProperty]],
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user: User,
    ) -> None:
        await create_order(save_fixture, product=product, user=user)

        orders, count = await user_order_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10), sorting=sorting
        )

        assert count == 1
        assert len(orders) == 1


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetById:
    @pytest.mark.auth
    async def test_other_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user_second: User,
    ) -> None:
        order = await create_order(save_fixture, product=product, user=user_second)

        result = await user_order_service.get_by_id(session, auth_subject, order.id)
        assert result is None

    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        user: User,
    ) -> None:
        order = await create_order(save_fixture, product=product, user=user)

        result = await user_order_service.get_by_id(session, auth_subject, order.id)

        assert result is not None
        assert result.id == order.id
