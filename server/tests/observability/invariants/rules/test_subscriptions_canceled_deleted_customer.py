import pytest
import pytest_asyncio

from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from polar.observability.invariants.rules.subscriptions_canceled_deleted_customer import (
    SubscriptionsCanceledDeletedCustomerInvariant,
    SubscriptionsCanceledDeletedCustomerInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_subscription


@pytest_asyncio.fixture
async def invariant(
    session: AsyncSession,
) -> SubscriptionsCanceledDeletedCustomerInvariant:
    return SubscriptionsCanceledDeletedCustomerInvariant(session)


@pytest.mark.asyncio
async def test_failure(
    invariant: SubscriptionsCanceledDeletedCustomerInvariant,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    organization: Organization,
) -> None:
    customer = await create_customer(
        save_fixture, organization=organization, email="deleted_customer@example.com"
    )
    customer.set_deleted_at()
    await save_fixture(customer)

    subscription = await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )

    with pytest.raises(SubscriptionsCanceledDeletedCustomerInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context == {
        "count": 1,
        "subscriptions": {"ids": [subscription.id], "has_more": False},
    }


@pytest.mark.asyncio
async def test_failure_over_limit(
    invariant: SubscriptionsCanceledDeletedCustomerInvariant,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    organization: Organization,
) -> None:
    for i in range(15):
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email=f"deleted_customer_{i}@example.com",
        )
        customer.set_deleted_at()
        await save_fixture(customer)

        await create_subscription(
            save_fixture,
            status=SubscriptionStatus.active,
            product=product,
            customer=customer,
        )

    with pytest.raises(SubscriptionsCanceledDeletedCustomerInvariantError) as exc_info:
        await invariant.check()
    assert exc_info.value.context["count"] == 15
    assert len(exc_info.value.context["subscriptions"]["ids"]) == 10
    assert exc_info.value.context["subscriptions"]["has_more"] is True


@pytest.mark.asyncio
async def test_success(
    invariant: SubscriptionsCanceledDeletedCustomerInvariant,
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    organization: Organization,
) -> None:
    # Active subscription with non-deleted customer
    customer = await create_customer(
        save_fixture, organization=organization, email="active_customer@example.com"
    )
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.active,
        product=product,
        customer=customer,
    )

    # Deleted customer with non-active subscription
    customer2 = await create_customer(
        save_fixture, organization=organization, email="deleted_customer@example.com"
    )
    customer2.set_deleted_at()
    await save_fixture(customer)
    await create_subscription(
        save_fixture,
        status=SubscriptionStatus.canceled,
        product=product,
        customer=customer2,
    )

    await invariant.check()
