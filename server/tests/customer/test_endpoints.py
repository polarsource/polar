import uuid

import pytest
from httpx import AsyncClient

from polar.member.repository import MemberRepository
from polar.models import (
    Benefit,
    Customer,
    Organization,
    Product,
    UserOrganization,
)
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
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

    @pytest.mark.auth
    async def test_query_filter_by_external_id(
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
            external_id="ext_123",
        )
        await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            external_id="ext_456",
        )
        await create_customer(
            save_fixture,
            organization=organization,
            email="customer3@example.com",
            external_id="ext_789",
        )

        response = await client.get("/v1/customers/", params={"query": "ext_456"})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["external_id"] == "ext_456"


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
        assert (
            json["granted_benefits"][0]["benefit_metadata"]
            == benefit_organization.user_metadata
        )


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

    @pytest.mark.auth
    async def test_empty_external_id_converts_to_none(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Test that empty string external_id is converted to None during creation
        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
                "external_id": "",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@example.com"
        assert json["external_id"] is None

    @pytest.mark.auth
    async def test_owner_override_all_fields(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that owner email, name, and external_id can all be overridden."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@polar.sh",
                "name": "Customer Name",
                "external_id": "customer_ext_123",
                "organization_id": str(organization.id),
                "owner": {
                    "email": "owner@polar.sh",
                    "name": "Owner Name",
                    "external_id": "owner_ext_456",
                },
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@polar.sh"
        assert json["name"] == "Customer Name"
        assert json["external_id"] == "customer_ext_123"

        member_repository = MemberRepository.from_session(session)
        owner = await member_repository.get_owner_by_customer_id(
            session, uuid.UUID(json["id"])
        )
        assert owner is not None
        assert owner.email == "owner@polar.sh"
        assert owner.name == "Owner Name"
        assert owner.external_id == "owner_ext_456"
        assert owner.role == "owner"


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

    @pytest.mark.auth
    async def test_empty_external_id_converts_to_none(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Create two customers with None external_id
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            external_id=None,
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            external_id=None,
        )

        # Try to update customer1 with empty string external_id
        # This should be converted to None and not cause a conflict
        response = await client.patch(
            f"/v1/customers/{customer1.id}",
            json={"external_id": ""},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["external_id"] is None

    @pytest.mark.auth
    async def test_external_id_conflict(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
    ) -> None:
        # Create two customers, one with an external_id
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
            external_id="existing_id",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            external_id=None,
        )

        # Try to update customer2 with customer1's external_id
        # This should fail with a conflict error
        response = await client.patch(
            f"/v1/customers/{customer2.id}",
            json={"external_id": "existing_id"},
        )

        assert response.status_code == 422
        json = response.json()
        assert any(
            "already exists" in str(error.get("msg", ""))
            for error in json.get("detail", [])
        )


@pytest.mark.asyncio
class TestDeleteCustomerWithAnonymize:
    """Tests for DELETE /customers/{id}?anonymize=true"""

    @pytest.mark.auth
    async def test_delete_with_anonymize(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Individual customers (no tax_id) should have name anonymized."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="individual@example.com",
            name="John Doe",
        )

        response = await client.delete(f"/v1/customers/{customer.id}?anonymize=true")

        assert response.status_code == 204

        # Verify anonymization by fetching directly from DB
        # (API filters out deleted customers)
        deleted = await session.get(Customer, customer.id)
        assert deleted is not None

        # Email should be hashed
        assert deleted.email.endswith("@anonymized.polar.sh")
        assert deleted.email_verified is False

        # Name should be hashed (64-char hex string from SHA-256)
        assert deleted.name is not None
        assert len(deleted.name) == 64
        assert deleted.name != "John Doe"

        # Customer should be marked as deleted
        assert deleted.deleted_at is not None

    @pytest.mark.auth
    async def test_business_customer_preserves_name(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Business customers (has tax_id) should have name preserved."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="business@example.com",
            name="Acme Corp",
            tax_id=("DE123456789", TaxIDFormat.eu_vat),
        )

        response = await client.delete(f"/v1/customers/{customer.id}?anonymize=true")

        assert response.status_code == 204

        # Verify by fetching directly from DB
        deleted = await session.get(Customer, customer.id)
        assert deleted is not None

        # Email should be hashed
        assert deleted.email.endswith("@anonymized.polar.sh")

        # Name should be PRESERVED for businesses
        assert deleted.name == "Acme Corp"

        # Tax ID should be PRESERVED
        assert deleted.tax_id is not None

    @pytest.mark.auth
    async def test_preserves_external_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """External ID should be preserved for legal reasons."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="external@example.com",
            external_id="ext-123",
        )

        response = await client.delete(f"/v1/customers/{customer.id}?anonymize=true")

        assert response.status_code == 204

        # Verify by fetching directly from DB
        deleted = await session.get(Customer, customer.id)
        assert deleted is not None

        # External ID should be PRESERVED
        assert deleted.external_id == "ext-123"

    @pytest.mark.auth
    async def test_delete_without_anonymize(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Delete without anonymize should not anonymize data."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="noanon@example.com",
            name="No Anon User",
        )

        response = await client.delete(f"/v1/customers/{customer.id}")

        assert response.status_code == 204

        # Verify customer is deleted but NOT anonymized (fetch from DB)
        deleted = await session.get(Customer, customer.id)
        assert deleted is not None

        # Email should NOT be hashed
        assert deleted.email == "noanon@example.com"

        # Name should NOT be hashed
        assert deleted.name == "No Anon User"

        # Customer should be marked as deleted
        assert deleted.deleted_at is not None


@pytest.mark.asyncio
class TestDeleteCustomerExternalWithAnonymize:
    """Tests for DELETE /customers/external/{external_id}?anonymize=true"""

    @pytest.mark.auth
    async def test_delete_with_anonymize(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="external-anon@example.com",
            external_id="ext-anon-123",
            name="External User",
        )

        response = await client.delete(
            f"/v1/customers/external/{customer.external_id}?anonymize=true"
        )

        assert response.status_code == 204

        # Verify by fetching directly from DB
        deleted = await session.get(Customer, customer.id)
        assert deleted is not None

        # Email should be hashed
        assert deleted.email.endswith("@anonymized.polar.sh")

        # External ID should be preserved
        assert deleted.external_id == "ext-anon-123"
