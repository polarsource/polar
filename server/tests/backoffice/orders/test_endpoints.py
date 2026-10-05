from collections.abc import AsyncGenerator
from datetime import timedelta
from html.parser import HTMLParser

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.kit.utils import utc_now
from polar.models import Customer, Product, User
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus, PaymentTrigger
from polar.models.subscription import SubscriptionStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment,
    create_subscription,
)


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
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


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.parametrize("with_payment", [False, True])
    async def test_dunning_details(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        with_payment: bool,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=utc_now(),
        )
        next_retry = utc_now() + timedelta(days=2)
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.pending,
            next_payment_attempt_at=next_retry,
        )
        if with_payment:
            await create_payment(
                save_fixture,
                order.organization,
                order=order,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.subscription_cycle,
            )

        response = await backoffice_client.get(f"/orders/{order.id}")

        assert response.status_code == 200
        parser = TextParser()
        parser.feed(response.text)
        content = " ".join(parser.parts)
        assert f"Next retry (UTC) {next_retry:%Y-%m-%d %H:%M:%S}" in content
        assert "Automatic retries remaining 4" in content
        if with_payment:
            assert "Trigger" in content
            assert "subscription_cycle" in content

    @pytest.mark.parametrize(
        "status", [OrderStatus.pending, OrderStatus.paid, OrderStatus.void]
    )
    async def test_no_retry_scheduled(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        status: OrderStatus,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=status,
        )
        response = await backoffice_client.get(f"/orders/{order.id}")

        assert response.status_code == 200
        parser = TextParser()
        parser.feed(response.text)
        content = " ".join(parser.parts)
        assert "Next retry (UTC) —" in content
        assert "Automatic retries remaining 0" in content
        assert "No automatic retry scheduled." in content

    @pytest.mark.parametrize("trigger", [*PaymentTrigger, None])
    async def test_payment_triggers(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        trigger: PaymentTrigger | None,
    ) -> None:
        order = await create_order(save_fixture, customer=customer, product=product)
        await create_payment(
            save_fixture, order.organization, order=order, trigger=trigger
        )

        response = await backoffice_client.get(f"/orders/{order.id}")

        assert response.status_code == 200
        parser = TextParser()
        parser.feed(response.text)
        content = " ".join(parser.parts)
        assert "Trigger" in content
        assert f"Succeeded {trigger or '—'} stripe" in content
        assert "Dunning" not in content
