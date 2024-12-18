from typing import Any

import pytest

from polar.auth.models import AuthSubject, is_user
from polar.authz.service import Authz
from polar.customer.schemas import CustomerCreate, CustomerUpdate
from polar.customer.service import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Organization, User, UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


@pytest.fixture
def authz(session: AsyncSession) -> Authz:
    return Authz(session)


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await customer_service.create(
                session,
                authz,
                CustomerCreate(
                    email="customer@example.com", organization_id=organization.id
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_existing_email(
        self,
        session: AsyncSession,
        authz: Authz,
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
                session,
                authz,
                CustomerCreate.model_validate(payload),
                auth_subject,
            )
            await session.flush()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_valid(
        self,
        session: AsyncSession,
        authz: Authz,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        payload: dict[str, Any] = {"email": "customer.new@example.com"}
        if is_user(auth_subject):
            payload["organization_id"] = str(organization.id)

        customer = await customer_service.create(
            session,
            authz,
            CustomerCreate.model_validate(payload),
            auth_subject,
        )
        await session.flush()

        assert customer.email == "customer.new@example.com"


@pytest.mark.asyncio
class TestUpdate:
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
    async def test_valid(
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
