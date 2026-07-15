from datetime import timedelta

import pytest
import pytest_asyncio

from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.observability.invariants.rules.no_recent_orders import (
    NoRecentOrdersInvariant,
    NoRecentOrdersInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest_asyncio.fixture
async def invariant(session: AsyncSession) -> NoRecentOrdersInvariant:
    return NoRecentOrdersInvariant(session)


@pytest.mark.asyncio
async def test_failure_no_orders(invariant: NoRecentOrdersInvariant) -> None:
    with pytest.raises(NoRecentOrdersInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["last_order_at"] is None


@pytest.mark.asyncio
async def test_failure_stale_order(
    invariant: NoRecentOrdersInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    await create_order(
        save_fixture,
        product=product,
        customer=customer,
        created_at=utc_now() - timedelta(hours=1),
    )

    with pytest.raises(NoRecentOrdersInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["last_order_at"] is not None


@pytest.mark.asyncio
async def test_success_recent_order(
    invariant: NoRecentOrdersInvariant,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    await create_order(save_fixture, product=product, customer=customer)

    await invariant.check()
