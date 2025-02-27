import pytest

from polar.customer.repository import CustomerRepository
from polar.models import Customer
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture
def repository(session: AsyncSession) -> CustomerRepository:
    return CustomerRepository.from_session(session)


@pytest.mark.asyncio
async def test_get_by_id(
    save_fixture: SaveFixture, customer: Customer, repository: CustomerRepository
) -> None:
    customer.set_deleted_at()
    await save_fixture(customer)

    result = await repository.get_by_id(customer.id, include_deleted=False)
    assert result is None

    result = await repository.get_by_id(customer.id, include_deleted=True)
    assert result == customer
