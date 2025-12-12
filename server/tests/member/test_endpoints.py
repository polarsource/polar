import uuid

import pytest
from httpx import AsyncClient

from polar.models import Member, Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_organization


@pytest.mark.asyncio
class TestListMembers:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/members/")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/members/")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_filter_by_customer_id(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Create customers with members
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
        )

        # Enable member feature flag
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        # Create members for customer1
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role="owner",
        )
        await save_fixture(member1)

        # Create members for customer2
        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role="member",
        )
        await save_fixture(member2)

        # Test filtering by customer1 ID
        response = await client.get(
            "/v1/members/", params={"customer_id": str(customer1.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["email"] == "member1@example.com"
        assert json["items"][0]["customer_id"] == str(customer1.id)

        # Test filtering by customer2 ID
        response = await client.get(
            "/v1/members/", params={"customer_id": str(customer2.id)}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["email"] == "member2@example.com"
        assert json["items"][0]["customer_id"] == str(customer2.id)

    @pytest.mark.auth
    async def test_list_all_members(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Create customers
        customer1 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer1@example.com",
        )
        customer2 = await create_customer(
            save_fixture,
            organization=organization,
            email="customer2@example.com",
        )

        # Create members
        member1 = Member(
            customer_id=customer1.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role="owner",
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer2.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role="member",
        )
        await save_fixture(member2)

        # Test listing all members without filter
        response = await client.get("/v1/members/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 2
        emails = {item["email"] for item in json["items"]}
        assert emails == {"member1@example.com", "member2@example.com"}

    @pytest.mark.auth
    async def test_pagination(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Create a customer
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        # Create multiple members with unique external_ids to avoid constraint violation
        for i in range(5):
            member = Member(
                customer_id=customer.id,
                organization_id=organization.id,
                email=f"member{i}@example.com",
                name=f"Member {i}",
                external_id=f"ext_{i}",
                role="member",
            )
            await save_fixture(member)

        # Test first page
        response = await client.get("/v1/members/", params={"page": 1, "limit": 2})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 5
        assert len(json["items"]) == 2

        # Test second page
        response = await client.get("/v1/members/", params={"page": 2, "limit": 2})

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 5
        assert len(json["items"]) == 2

    @pytest.mark.auth
    async def test_not_accessible_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        # Create a customer for a different organization that the user doesn't have access to
        from tests.fixtures.random_objects import create_organization

        other_org = await create_organization(save_fixture)
        customer = await create_customer(
            save_fixture,
            organization=other_org,
            email="customer@example.com",
        )

        # Create a member
        member = Member(
            customer_id=customer.id,
            organization_id=other_org.id,
            email="member@example.com",
            name="Member",
            role="member",
        )
        await save_fixture(member)

        # Try to list members - should not see the member from other organization
        response = await client.get("/v1/members/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0


@pytest.mark.asyncio
class TestCreateMember:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": "00000000-0000-0000-0000-000000000000",
                "email": "test@example.com",
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": "00000000-0000-0000-0000-000000000000",
                "email": "test@example.com",
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_create_member_success(
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

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "newmember@example.com",
                "name": "New Member",
                "role": "member",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["email"] == "newmember@example.com"
        assert json["name"] == "New Member"
        assert json["customer_id"] == str(customer.id)
        assert json["role"] == "member"

    @pytest.mark.auth
    async def test_create_member_with_external_id(
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

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "member@example.com",
                "external_id": "ext_123",
                "role": "billing_manager",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["email"] == "member@example.com"
        assert json["external_id"] == "ext_123"
        assert json["role"] == "billing_manager"

    @pytest.mark.auth
    async def test_create_member_duplicate_email(
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
            email="duplicate@example.com",
            role="member",
        )
        await save_fixture(member)

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "duplicate@example.com",
                "role": "member",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["email"] == "duplicate@example.com"
        assert json["id"] == str(member.id)

    @pytest.mark.auth
    async def test_create_member_feature_flag_disabled(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": False}
        await save_fixture(organization)

        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "member@example.com",
            },
        )

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_create_member_customer_not_found(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        organization.feature_settings = {"member_model_enabled": True}
        await save_fixture(organization)

        non_existent_customer_id = str(uuid.uuid4())
        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": non_existent_customer_id,
                "email": "member@example.com",
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_create_member_different_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        other_org = await create_organization(save_fixture)
        other_org.feature_settings = {"member_model_enabled": True}
        await save_fixture(other_org)

        customer = await create_customer(
            save_fixture,
            organization=other_org,
            email="customer@example.com",
        )

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "member@example.com",
            },
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_create_member_default_role(
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

        response = await client.post(
            "/v1/members/",
            json={
                "customer_id": str(customer.id),
                "email": "member@example.com",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["role"] == "member"


@pytest.mark.asyncio
class TestDeleteMember:
    async def test_anonymous(self, client: AsyncClient) -> None:
        member_id = str(uuid.uuid4())
        response = await client.delete(f"/v1/members/{member_id}")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        member_id = str(uuid.uuid4())
        response = await client.delete(f"/v1/members/{member_id}")

        assert response.status_code == 403

    @pytest.mark.auth
    async def test_delete_member_success(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Create a customer and member
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Test Member",
            role="member",
        )
        await save_fixture(member)

        # Delete the member
        response = await client.delete(f"/v1/members/{member.id}")

        assert response.status_code == 204

        # Verify member is soft-deleted (should not be found in list)
        list_response = await client.get(
            "/v1/members/", params={"customer_id": str(customer.id)}
        )
        assert list_response.status_code == 200
        json = list_response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth
    async def test_delete_member_not_found(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        non_existent_member_id = str(uuid.uuid4())
        response = await client.delete(f"/v1/members/{non_existent_member_id}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_delete_member_different_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        # Create a member for a different organization
        other_org = await create_organization(save_fixture)
        customer = await create_customer(
            save_fixture,
            organization=other_org,
            email="customer@example.com",
        )

        member = Member(
            customer_id=customer.id,
            organization_id=other_org.id,
            email="member@example.com",
            name="Test Member",
            role="member",
        )
        await save_fixture(member)

        # Try to delete the member - should fail because user doesn't have access
        response = await client.delete(f"/v1/members/{member.id}")

        assert response.status_code == 404
