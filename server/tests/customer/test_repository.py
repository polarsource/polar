import pytest
from pytest_mock import MockerFixture

from polar.customer.repository import CustomerRepository
from polar.event.system import SystemEvent
from polar.models import Customer, Organization
from polar.models.customer import CustomerType, _avatar_url_for_email
from polar.models.member import MemberRole
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_member


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


@pytest.mark.asyncio
class TestOwnerRelationship:
    """The `owner` relationship is eager-loaded (`lazy="selectin"`) on every
    customer query, so accessing it never raises and always reflects the single
    active owner member."""

    async def test_loaded_on_fetch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        repository: CustomerRepository,
        customer: Customer,
        organization: Organization,
    ) -> None:
        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.member,
            email="member@example.com",
        )

        session.expunge_all()
        result = await repository.get_by_id(customer.id)

        assert result is not None
        assert result.owner is not None
        assert result.owner.id == owner.id

    async def test_none_without_owner(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        repository: CustomerRepository,
        customer: Customer,
        organization: Organization,
    ) -> None:
        await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.billing_manager,
        )

        session.expunge_all()
        result = await repository.get_by_id(customer.id)

        assert result is not None
        assert result.owner is None

    async def test_ignores_soft_deleted_owner(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        repository: CustomerRepository,
        customer: Customer,
        organization: Organization,
    ) -> None:
        owner = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
        )
        owner.set_deleted_at()
        await save_fixture(owner)

        session.expunge_all()
        result = await repository.get_by_id(customer.id)

        assert result is not None
        assert result.owner is None


@pytest.mark.asyncio
class TestAvatarUrl:
    """`avatar_url` uses the customer's own email, falls back to the owner
    member's email when the customer has none, and is `None` otherwise."""

    @pytest.mark.parametrize(
        ("customer_email", "owner_email", "expected_email"),
        [
            ("individual@example.com", None, "individual@example.com"),
            ("team@example.com", "owner@example.com", "team@example.com"),
            (None, "owner@example.com", "owner@example.com"),
            (None, None, None),
        ],
    )
    async def test_avatar_url(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        repository: CustomerRepository,
        organization: Organization,
        customer_email: str | None,
        owner_email: str | None,
        expected_email: str | None,
    ) -> None:
        customer = Customer(
            email=customer_email,
            type=CustomerType.team,
            organization=organization,
        )
        await save_fixture(customer)
        if owner_email is not None:
            await create_member(
                save_fixture,
                customer=customer,
                organization=organization,
                role=MemberRole.owner,
                email=owner_email,
            )

        session.expunge_all()
        result = await repository.get_by_id(customer.id)

        assert result is not None
        assert result.avatar_url == (
            _avatar_url_for_email(expected_email) if expected_email else None
        )
