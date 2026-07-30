from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.models import Customer, User
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.refund.schemas import RefundCreate
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient, None]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


@pytest.mark.asyncio
class TestRefund:
    @pytest.mark.parametrize(
        ("currency", "amount", "expected_amount"),
        [
            ("jpy", "500", 500),
            ("usd", "5.25", 525),
        ],
    )
    async def test_post_uses_currency_decimal_factor_for_amount(
        self,
        currency: str,
        amount: str,
        expected_amount: int,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        mocker: MockerFixture,
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            currency=currency,
            subtotal_amount=100000,
        )

        create_refund_mock = mocker.patch(
            "polar.backoffice.orders.endpoints.refund_service.create",
            new=mocker.AsyncMock(),
        )

        response = await backoffice_client.post(
            f"/orders/{order.id}/refund",
            data={"reason": "duplicate", "amount": amount},
        )

        assert response.status_code == 303
        create_refund_mock.assert_awaited_once()
        refund_create = create_refund_mock.await_args.args[2]
        assert isinstance(refund_create, RefundCreate)
        assert refund_create.order_id == order.id
        assert refund_create.amount == expected_amount
