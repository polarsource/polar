import pytest
from sqlalchemy import select

from polar.models import Organization, UserCustomer
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
        save_fixture, organization=organization, email=user.email
    )
    user_customer1 = UserCustomer(user=user, customer=customer1)
    await save_fixture(user_customer1)

    customer2 = await create_customer(
        save_fixture, organization=organization_second, email=user.email
    )

    organization_third = await create_organization(save_fixture)
    customer3 = await create_customer(
        save_fixture, organization=organization_third, email=user.email
    )

    await user_service.link_customers(session, user)

    user_customer_statement = select(UserCustomer).where(
        UserCustomer.user_id == user.id
    )
    result = await session.execute(user_customer_statement)
    user_customers = result.scalars().all()

    assert len(user_customers) == 3
    assert user_customers[0].customer_id == customer1.id
    assert user_customers[1].customer_id == customer2.id
    assert user_customers[2].customer_id == customer3.id
