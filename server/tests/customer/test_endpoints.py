import pytest
from httpx import AsyncClient

from polar.models import Customer, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
class TestUpdateCustomer:
    async def test_anonymous(self, client: AsyncClient, customer: Customer) -> None:
        response = await client.patch(
            f"/v1/customers/{customer.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        response = await client.patch(
            f"/v1/customers/{customer.id}",
            json={
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_email_already_exists(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        response = await client.patch(
            f"/v1/customers/{customer.id}",
            json={
                "email": customer_second.email,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_email_update(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        email_verified_customer = await create_customer(
            save_fixture, organization=organization, email_verified=True
        )
        response = await client.patch(
            f"/v1/customers/{email_verified_customer.id}",
            json={"email": "email.updated@example.com"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["email"] == "email.updated@example.com"
        assert json["email_verified"] is False
