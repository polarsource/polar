import uuid

import pytest
from httpx import AsyncClient

from polar.customer_session.service import CUSTOMER_SESSION_TOKEN_PREFIX
from polar.models import Customer, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestCreate:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(uuid.uuid4())}
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_cant_manage_customer(
        self, client: AsyncClient, customer: Customer
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )
        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        customer: Customer,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/customer-sessions/", json={"customer_id": str(customer.id)}
        )
        assert response.status_code == 201

        json = response.json()

        assert json["token"].startswith(CUSTOMER_SESSION_TOKEN_PREFIX)
        assert json["customer_id"] == str(customer.id)
