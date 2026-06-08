import pytest
from pytest_mock import MockerFixture

from polar.customer.repository import CustomerRepository
from polar.event.system import SystemEvent
from polar.models import Customer, Organization
from polar.models.webhook_endpoint import WebhookEventType
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


@pytest.mark.asyncio
async def test_create_context(
    mocker: MockerFixture,
    session: AsyncSession,
    repository: CustomerRepository,
    organization: Organization,
) -> None:
    enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

    async with repository.create_context(
        Customer(email="customer@example.com", organization=organization)
    ) as customer:
        assert customer.id is not None
        await session.flush()

    enqueue_job_mock.assert_any_call(
        "customer.webhook", WebhookEventType.customer_created, customer.id
    )

    enqueue_job_mock.reset_mock()

    with pytest.raises(RuntimeError):
        async with repository.create_context(
            Customer(email="customer2@example.com", organization=organization)
        ) as customer:
            # Simulate an error during context execution
            raise RuntimeError("Simulated error")

    enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
async def test_update_tracks_billing_name(
    mocker: MockerFixture,
    customer: Customer,
    repository: CustomerRepository,
) -> None:
    enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

    # `billing_name` is exposed via a property backed by the `_billing_name`
    # column, which is exactly the path the customer portal update goes through.
    customer.billing_name = "New Billing Name"
    await repository.update(customer)

    enqueue_job_mock.assert_any_call(
        "customer.event",
        customer.id,
        SystemEvent.customer_updated,
        {"billing_name": "New Billing Name"},
    )


@pytest.mark.asyncio
async def test_update_without_changes_emits_empty_updated_fields(
    mocker: MockerFixture,
    customer: Customer,
    repository: CustomerRepository,
) -> None:
    enqueue_job_mock = mocker.patch("polar.customer.repository.enqueue_job")

    await repository.update(customer)

    enqueue_job_mock.assert_any_call(
        "customer.event",
        customer.id,
        SystemEvent.customer_updated,
        {},
    )
