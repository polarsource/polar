from typing import Any

import pytest

from polar.auth.models import AuthSubject, is_user
from polar.customer.schemas import CustomerCreate, CustomerUpdate
from polar.customer.service import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.models import Customer, Organization, User, UserOrganization
from polar.postgres import AsyncSession
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
