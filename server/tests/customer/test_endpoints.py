import uuid

import pytest
from httpx import AsyncClient

from polar.models import (
    Benefit,
    Customer,
    Member,
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

    @pytest.mark.auth
    async def test_include_members_false(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Enable member model feature flag
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Create members for the customer
        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member One",
            role="owner",
            external_id="ext_member1",
        )
        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member Two",
            role="member",
            external_id="ext_member2",
        )
        await save_fixture(member1)
        await save_fixture(member2)

        response = await client.get("/v1/customers/", params={"include_members": False})

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) > 0
        for item in json["items"]:
            assert "members" in item
            assert item["members"] == []

    @pytest.mark.auth
    async def test_include_members_true(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Enable member model feature flag
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Create members for the customer
        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member One",
            role="owner",
            external_id="ext_member1",
        )
        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member Two",
            role="member",
            external_id="ext_member2",
        )
        await save_fixture(member1)
        await save_fixture(member2)

        response = await client.get("/v1/customers/", params={"include_members": True})

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) > 0

        # Find our customer in the response
        customer_data = next(
            (item for item in json["items"] if item["id"] == str(customer.id)), None
        )
        assert customer_data is not None
        assert "members" in customer_data
        assert len(customer_data["members"]) == 2

        # Verify member data
        member_emails = {m["email"] for m in customer_data["members"]}
        assert "member1@example.com" in member_emails
        assert "member2@example.com" in member_emails

        member_names = {m["name"] for m in customer_data["members"]}
        assert "Member One" in member_names
        assert "Member Two" in member_names


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

    @pytest.mark.auth
    async def test_include_members_true(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Enable member model feature flag
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
            external_id="test_ext_id",
        )

        # Create members for the customer
        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="owner@example.com",
            name="Owner Member",
            role="owner",
            external_id="ext_owner",
        )
        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="regular@example.com",
            name="Regular Member",
            external_id="ext_member_1",
            role="member",
        )
        await save_fixture(member1)
        await save_fixture(member2)

        response = await client.get(
            f"/v1/customers/external/{customer.external_id}",
            params={"include_members": True},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(customer.id)
        assert "members" in json
        assert len(json["members"]) == 2

        # Verify member data
        member_emails = {m["email"] for m in json["members"]}
        assert "owner@example.com" in member_emails
        assert "regular@example.com" in member_emails

        # Verify one member has external_id
        member_with_external = next(
            (m for m in json["members"] if m["external_id"] == "ext_member_1"), None
        )
        assert member_with_external is not None
        assert member_with_external["name"] == "Regular Member"

    @pytest.mark.auth
    async def test_include_members_false(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Enable member model feature flag
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
            external_id="test_ext_id_2",
        )

        # Create a member
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role="owner",
            external_id="ext_member",
        )
        await save_fixture(member)

        response = await client.get(
            f"/v1/customers/external/{customer.external_id}",
            params={"include_members": False},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(customer.id)
        assert "members" in json
        assert json["members"] == []


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
    async def test_include_members_true(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
            },
            params={"include_members": True},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@example.com"
        assert "members" in json
        assert len(json["members"]) == 1
        assert json["members"][0]["email"] == "customer@example.com"
        assert json["members"][0]["role"] == "owner"

    @pytest.mark.auth
    async def test_include_members_false(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@example.com",
                "organization_id": str(organization.id),
            },
            params={"include_members": False},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@example.com"
        assert "members" in json
        assert len(json["members"]) == 0

    @pytest.mark.auth
    async def test_owner_override_all_fields(
        self,
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
            params={"include_members": True},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@polar.sh"
        assert json["name"] == "Customer Name"
        assert json["external_id"] == "customer_ext_123"
        assert "members" in json
        assert len(json["members"]) == 1

        owner = json["members"][0]
        assert owner["email"] == "owner@polar.sh"
        assert owner["name"] == "Owner Name"
        assert owner["external_id"] == "owner_ext_456"
        assert owner["role"] == "owner"

    @pytest.mark.auth
    async def test_owner_override_email_only(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner email can be overridden, name and external_id fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@polar.sh",
                "name": "Customer Name",
                "external_id": "customer_ext_789",
                "organization_id": str(organization.id),
                "owner": {
                    "email": "different.owner@polar.sh",
                },
            },
            params={"include_members": True},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@polar.sh"
        assert json["name"] == "Customer Name"
        assert json["external_id"] == "customer_ext_789"
        assert "members" in json
        assert len(json["members"]) == 1

        owner = json["members"][0]
        assert owner["email"] == "different.owner@polar.sh"
        assert owner["name"] == "Customer Name"
        assert owner["external_id"] == "customer_ext_789"
        assert owner["role"] == "owner"

    @pytest.mark.auth
    async def test_owner_override_name_only(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner name can be overridden, email and external_id fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@polar.sh",
                "name": "Customer Name",
                "external_id": "customer_ext_abc",
                "organization_id": str(organization.id),
                "owner": {
                    "name": "Different Owner Name",
                },
            },
            params={"include_members": True},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@polar.sh"
        assert json["name"] == "Customer Name"
        assert json["external_id"] == "customer_ext_abc"
        assert "members" in json
        assert len(json["members"]) == 1

        owner = json["members"][0]
        assert owner["email"] == "customer@polar.sh"
        assert owner["name"] == "Different Owner Name"
        assert owner["external_id"] == "customer_ext_abc"
        assert owner["role"] == "owner"

    @pytest.mark.auth
    async def test_owner_override_external_id_only(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that only owner external_id can be overridden, email and name fall back to customer values."""
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        response = await client.post(
            "/v1/customers/",
            json={
                "email": "customer@polar.sh",
                "name": "Customer Name",
                "external_id": "customer_ext_xyz",
                "organization_id": str(organization.id),
                "owner": {
                    "external_id": "different_owner_ext_id",
                },
            },
            params={"include_members": True},
        )

        assert response.status_code == 201

        json = response.json()
        assert json["email"] == "customer@polar.sh"
        assert json["name"] == "Customer Name"
        assert json["external_id"] == "customer_ext_xyz"
        assert "members" in json
        assert len(json["members"]) == 1

        owner = json["members"][0]
        assert owner["email"] == "customer@polar.sh"
        assert owner["name"] == "Customer Name"
        assert owner["external_id"] == "different_owner_ext_id"
        assert owner["role"] == "owner"


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

    @pytest.mark.auth
    async def test_include_members_true(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member One",
            role="member",
            external_id="ext_member",
        )
        await save_fixture(member)

        response = await client.patch(
            f"/v1/customers/{customer.id}",
            json={"metadata": {"test": "test"}},
            params={"include_members": True},
        )

        assert response.status_code == 200

        json = response.json()
        assert "members" in json
        assert len(json["members"]) >= 1
        member_emails = {m["email"] for m in json["members"]}
        assert "member@example.com" in member_emails

    @pytest.mark.auth
    async def test_include_members_false(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member One",
            role="member",
            external_id="ext_member",
        )
        await save_fixture(member)

        response = await client.patch(
            f"/v1/customers/{customer.id}",
            json={"metadata": {"test": "test"}},
            params={"include_members": False},
        )

        assert response.status_code == 200

        json = response.json()
        assert "members" in json
        assert len(json["members"]) == 0
