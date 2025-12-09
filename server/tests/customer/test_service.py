from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject, is_user
from polar.customer.schemas.customer import CustomerCreate, CustomerUpdate
from polar.customer.service import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.address import AddressInput, CountryAlpha2Input
from polar.kit.pagination import PaginationParams
from polar.member.repository import MemberRepository
from polar.models import Customer, Organization, User, UserOrganization
from polar.models.member import MemberRole
from polar.models.webhook_endpoint import CustomerWebhookEventType, WebhookEventType
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_not_accessible_organization(
        self, session: AsyncSession, auth_subject: AuthSubject[User], customer: Customer
    ) -> None:
        customers, total = await customer_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )
        assert len(customers) == 0
        assert total == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            user_metadata={"user_id": "ABC"},
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            user_metadata={"user_id": "DEF"},
        )
        await create_customer(
            save_fixture,
            organization=organization,
            email="customer3@example.com",
            user_metadata={"user_id": "GHI"},
        )

        customers, total = await customer_service.list(
            session,
            auth_subject,
            metadata={"user_id": ["ABC", "DEF"]},
            pagination=PaginationParams(1, 10),
        )

        assert len(customers) == 2
        assert total == 2

        assert customer1 in customers
        assert customer2 in customers


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_service.create(
                session,
                CustomerCreate(
                    email="customer@example.com", organization_id=organization.id
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_existing_external_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
        customer_external_id: Customer,
    ) -> None:
        payload: dict[str, Any] = {
            "email": "customer@example.com",
            "external_id": customer_external_id.external_id,
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        with pytest.raises(PolarRequestValidationError):
            await customer_service.create(
                session, CustomerCreate.model_validate(payload), auth_subject
            )
            await session.flush()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_existing_email(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        payload: dict[str, Any] = {
            "email": customer.email.upper()  # Check case-insensitive index
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        with pytest.raises(PolarRequestValidationError):
            await customer_service.create(
                session, CustomerCreate.model_validate(payload), auth_subject
            )
            await session.flush()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payload: dict[str, Any] = {
            "email": "customer.new@example.com",
            "external_id": "123",
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        assert customer.external_id == "123"
        assert customer.email == "customer.new@example.com"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_creates_owner_member_when_flag_enabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        payload: dict[str, Any] = {
            "email": "customer.with.member@example.com",
            "name": "Test Customer",
            "external_id": "member_test_123",
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        assert customer.email == "customer.with.member@example.com"
        assert customer.name == "Test Customer"

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(session, customer)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == customer.email
        assert member.name == customer.name
        assert member.external_id == customer.external_id
        assert member.role == MemberRole.owner

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_no_member_when_flag_disabled(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": False}

        payload: dict[str, Any] = {
            "email": "customer.without.member@example.com",
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        assert customer.email == "customer.without.member@example.com"

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(session, customer)
        assert member is None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_owner_override_all_fields(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that owner email, name, and external_id can be overridden."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        payload: dict[str, Any] = {
            "email": "customer@polar.sh",
            "name": "Customer Name",
            "external_id": "customer_ext_123",
            "owner": {
                "email": "owner@polar.sh",
                "name": "Owner Name",
                "external_id": "owner_ext_456",
            },
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        assert customer.email == "customer@polar.sh"
        assert customer.name == "Customer Name"
        assert customer.external_id == "customer_ext_123"

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(
            session, customer, email="owner@polar.sh"
        )
        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == "owner@polar.sh"
        assert member.name == "Owner Name"
        assert member.external_id == "owner_ext_456"
        assert member.role == MemberRole.owner

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_owner_override_partial_email_only(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner email can be overridden while name and external_id fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        payload: dict[str, Any] = {
            "email": "customer@polar.sh",
            "name": "Customer Name",
            "external_id": "customer_ext_789",
            "owner": {
                "email": "different.owner@polar.sh",
            },
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        assert customer.email == "customer@polar.sh"
        assert customer.name == "Customer Name"
        assert customer.external_id == "customer_ext_789"

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(
            session, customer, email="different.owner@polar.sh"
        )
        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == "different.owner@polar.sh"
        assert member.name == "Customer Name"
        assert member.external_id == "customer_ext_789"
        assert member.role == MemberRole.owner

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_owner_override_name_only(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner name can be overridden while email and external_id fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        payload: dict[str, Any] = {
            "email": "customer@polar.sh",
            "name": "Customer Name",
            "external_id": "customer_ext_abc",
            "owner": {
                "name": "Different Owner Name",
            },
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(session, customer)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == "customer@polar.sh"
        assert member.name == "Different Owner Name"
        assert member.external_id == "customer_ext_abc"
        assert member.role == MemberRole.owner

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_owner_override_external_id_only(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner external_id can be overridden while email and name fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        payload: dict[str, Any] = {
            "email": "customer@polar.sh",
            "name": "Customer Name",
            "external_id": "customer_ext_xyz",
            "owner": {
                "external_id": "different_owner_ext_id",
            },
        }
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session, CustomerCreate.model_validate(payload), auth_subject
        )
        await session.flush()

        member_repository = MemberRepository.from_session(session)
        member = await member_repository.get_by_customer_and_email(session, customer)
        assert member is not None
        assert member.customer_id == customer.id
        assert member.email == "customer@polar.sh"
        assert member.name == "Customer Name"
        assert member.external_id == "different_owner_ext_id"
        assert member.role == MemberRole.owner


@pytest.mark.asyncio
class TestUpdate:
    async def test_existing_external_id(
        self, session: AsyncSession, customer: Customer, customer_external_id: Customer
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer,
                CustomerUpdate(external_id=customer_external_id.external_id),
            )
            await session.flush()

    @pytest.mark.parametrize(
        "external_id",
        [
            pytest.param("123", id="different external_id"),
            pytest.param(None, id="remove external_id"),
        ],
    )
    async def test_cant_update_external_id(
        self,
        external_id: str | None,
        session: AsyncSession,
        customer_external_id: Customer,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer_external_id,
                CustomerUpdate(external_id=external_id),
            )
            await session.flush()

    async def test_existing_email(
        self, session: AsyncSession, customer: Customer, customer_second: Customer
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_service.update(
                session,
                customer,
                CustomerUpdate(email=customer_second.email),
            )
            await session.flush()

    @pytest.mark.parametrize(
        "email",
        [
            pytest.param("customer@example.com", id="same email"),
            pytest.param("customer.updated@example.cm", id="different email"),
        ],
    )
    async def test_valid_email(
        self, email: str, session: AsyncSession, customer: Customer
    ) -> None:
        customer = await customer_service.update(
            session,
            customer,
            CustomerUpdate(email=email, name="John"),
        )
        await session.flush()

        assert customer.email == email
        assert customer.name == "John"

    async def test_valid_external_id(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        customer = await customer_service.update(
            session,
            customer,
            CustomerUpdate(external_id="123", name="John"),
        )
        await session.flush()

        assert customer.external_id == "123"
        assert customer.name == "John"

    async def test_valid_same_external_id(
        self, session: AsyncSession, customer_external_id: Customer
    ) -> None:
        customer = await customer_service.update(
            session,
            customer_external_id,
            CustomerUpdate(external_id=customer_external_id.external_id),
        )
        await session.flush()

        assert customer.external_id == customer_external_id.external_id

    async def test_valid_explicitly_none_email(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerUpdate(email=None),
        )
        await session.flush()

        assert updated_customer.email == customer.email

    async def test_valid_billing_address(
        self, session: AsyncSession, customer: Customer
    ) -> None:
        updated_customer = await customer_service.update(
            session,
            customer,
            CustomerUpdate(
                billing_address=AddressInput(
                    line1="123 Main St",
                    city="San Francisco",
                    state="CA",
                    postal_code="94102",
                    country=CountryAlpha2Input("US"),
                )
            ),
        )
        await session.flush()
        await session.refresh(updated_customer)

        assert updated_customer.billing_address is not None
        assert updated_customer.billing_address.line1 == "123 Main St"
        assert updated_customer.billing_address.city == "San Francisco"
        assert updated_customer.billing_address.state == "US-CA"
        assert updated_customer.billing_address.postal_code == "94102"
        assert updated_customer.billing_address.country == "US"


@pytest.mark.asyncio
class TestDelete:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="delete-me@example.com",
            external_id="external-id",
            user_metadata={"user_id": "ABC"},
        )
        assert customer.deleted_at is None
        soft_deleted = await customer_service.delete(session, customer)
        assert soft_deleted.deleted_at is not None
        assert soft_deleted.external_id is None
        assert soft_deleted.user_metadata["__external_id"] == "external-id"
        assert soft_deleted.user_metadata["user_id"] == "ABC"
        await session.flush()

    async def test_valid_recycled_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="delete-me@example.com",
            external_id="will-be-recycled",
            user_metadata={"user_id": "ABC"},
        )
        soft_deleted = await customer_service.delete(session, customer)
        assert soft_deleted.deleted_at
        assert soft_deleted.external_id is None
        await session.flush()

        try:
            recycled = await create_customer(
                save_fixture,
                organization=organization,
                email=customer.email,
                external_id="will-be-recycled",
                user_metadata={"user_id": "ABC"},
            )
        except IntegrityError:
            pytest.fail("Should not raise IntegrityError")

        assert recycled.id is not None
        assert recycled.id != customer.id
        assert recycled.deleted_at is None
        assert recycled.external_id == "will-be-recycled"

        with pytest.raises(IntegrityError):
            await create_customer(
                save_fixture,
                organization=organization,
                email=recycled.email,
                external_id=recycled.external_id,
                user_metadata=recycled.user_metadata,
            )


@pytest.mark.asyncio
class TestWebhook:
    @pytest.mark.parametrize(
        "event_type",
        [
            WebhookEventType.customer_created,
            WebhookEventType.customer_updated,
            WebhookEventType.customer_deleted,
        ],
    )
    async def test_scalar_events(
        self,
        event_type: CustomerWebhookEventType,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
    ) -> None:
        send_mock = mocker.patch("polar.webhook.service.webhook.send")

        await customer_service.webhook(session, redis, event_type, customer)

        assert send_mock.call_count == 2

    async def test_state_changed_event(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        redis: Redis,
        customer: Customer,
    ) -> None:
        send_mock = mocker.patch("polar.webhook.service.webhook.send")

        await customer_service.webhook(
            session, redis, WebhookEventType.customer_state_changed, customer
        )

        assert send_mock.call_count == 1
