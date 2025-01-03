import pytest

from polar.models import Customer, Organization
from polar.postgres import AsyncSession
from polar.user.service.user import user as user_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_organization,
    create_user,
)


@pytest.mark.asyncio
async def test_link_customers(
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    organization_second: Organization,
) -> None:
    user = await create_user(save_fixture)

    customer1 = await create_customer(
        save_fixture, organization=organization, email=user.email, user=user
    )

    customer2 = await create_customer(
        save_fixture, organization=organization_second, email=user.email
    )

    organization_third = await create_organization(save_fixture)
    customer3 = await create_customer(
        save_fixture, organization=organization_third, email=user.email
    )

    await user_service.link_customers(session, user)

    for customer in [customer1, customer2, customer3]:
        updated_customer = await session.get(Customer, customer.id)
        assert updated_customer is not None
        assert updated_customer.user_id == user.id
