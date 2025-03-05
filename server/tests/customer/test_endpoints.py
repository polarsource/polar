import uuid

import pytest
from httpx import AsyncClient

from polar.models import (
    Benefit,
    Customer,
    Organization,
    Product,
    UserOrganization,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_benefit_grant,
    create_customer,
)


@pytest.mark.asyncio
class TestListCustomers:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customers/")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/customers/")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            user_metadata={"user_id": "ABC"},
        )
        await create_customer(
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

        response = await client.get(
            "/v1/customers/", params={"metadata[user_id]": ["ABC", "DEF"]}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2


@pytest.mark.asyncio
class TestGetExternal:
    async def test_anonymous(
        self, client: AsyncClient, customer_external_id: Customer
    ) -> None:
        response = await client.get(
            f"/v1/customers/external/{customer_external_id.external_id}"
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_external_id: Customer,
    ) -> None:
        response = await client.get(
            f"/v1/customers/external/{customer_external_id.external_id}"
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_not_existing(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/customers/external/not-existing")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_external_id: Customer,
    ) -> None:
        response = await client.get(
            f"/v1/customers/external/{customer_external_id.external_id}"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(customer_external_id.id)


@pytest.mark.asyncio
class TestGetState:
    async def test_anonymous(self, client: AsyncClient, customer: Customer) -> None:
        response = await client.get(f"/v1/customers/{customer.id}/state")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        response = await client.get(f"/v1/customers/{customer.id}/state")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_not_existing(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.get(f"/v1/customers/{uuid.uuid4()}/state")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        product: Product,
        benefit_organization: Benefit,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )
        revoked_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
        )

        response = await client.get(f"/v1/customers/{customer.id}/state")

        assert response.status_code == 200

        json = response.json()

        assert len(json["active_subscriptions"]) == 1
        assert json["active_subscriptions"][0]["id"] == str(subscription.id)

        assert len(json["granted_benefits"]) == 1
        assert json["granted_benefits"][0]["id"] == str(grant.id)
        assert json["granted_benefits"][0]["benefit_type"] == benefit_organization.type


@pytest.mark.asyncio
class TestCreateCustomer:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_not_writable_organization(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
                "metadata": {"test": "test"},
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@example.com"
        assert json["organization_id"] == str(organization.id)
        assert json["metadata"] == {"test": "test"}


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

    @pytest.mark.auth
    async def test_metadata_update(
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
            json={"metadata": {"test": "test"}},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["metadata"] == {"test": "test"}
