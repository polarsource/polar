import httpx
import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Order, Organization, User
from tests.e2e.worker.executor import TaskExecutor
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_product


@pytest.mark.asyncio
class TestCheckoutFlow:
    """E2E tests for the complete checkout flow."""

    @pytest.mark.usefixtures(
        "patch_broker",
        "patch_task_middlewares",
        "current_message",
        "set_job_queue_manager",
    )
    async def test_checkout_creates_order(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        billing_organization: Organization,
        billing_user: User,
        billing_account: Account,
        task_executor: TaskExecutor,
        client: httpx.AsyncClient,
    ) -> None:
        """
        Test complete checkout flow: checkout -> confirm -> order.

        Flow:
        1. Create checkout for a free one-time product via API
        2. Customer confirms checkout via API
        3. checkout.handle_free_success task executes
        4. Order is created
        5. Customer is associated with the order
        """
        # Create a FREE one-time product (no payment or payment setup required)
        product = await create_product(
            save_fixture,
            organization=billing_organization,
            name="Free Product",
            recurring_interval=None,  # One-time product
            prices=[(0, "usd")],
        )

        # 1. Create checkout via API
        response = await client.post(
            "/v1/checkouts/client/",
            json={"product_id": str(product.id)},
        )
        assert response.status_code == 201, f"Create checkout failed: {response.text}"
        checkout_data = response.json()
        assert checkout_data["status"] == "open"
        client_secret = checkout_data["client_secret"]

        # 2. Customer confirms checkout via API
        response = await client.post(
            f"/v1/checkouts/client/{client_secret}/confirm",
            json={
                "customer_name": "Test Customer",
                "customer_email": "customer@example.com",
            },
        )
        assert response.status_code == 200, f"Confirm checkout failed: {response.text}"
        confirmed_data = response.json()
        assert confirmed_data["status"] == "confirmed"

        # 3. Execute all tasks (checkout.handle_free_success -> creates order)
        await task_executor.run_pending(timeout=10.0)

        # 4. Verify order was created
        from sqlalchemy.orm import joinedload

        result = await session.execute(
            select(Order)
            .where(Order.product_id == product.id)
            .options(joinedload(Order.customer))
        )
        order = result.scalar_one()
        assert order is not None

        # 5. Verify customer email on the order
        assert order.customer is not None
        assert order.customer.email == "customer@example.com"
