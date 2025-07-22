import uuid

import pytest
from httpx import AsyncClient

from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.auth import AuthSubjectFixture


@pytest.mark.asyncio
class TestListOrganizations:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(self, client: AsyncClient) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/organizations/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(organization.id)


@pytest.mark.asyncio
class TestGetOrganization:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/organizations/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/organizations/{organization.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(organization.id)


@pytest.mark.asyncio
class TestUpdateOrganization:
    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/organizations/{uuid.uuid4()}", json={})

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_not_admin(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.patch(f"/v1/organizations/{organization.id}", json={})

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid_user(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/organizations/{organization.id}", json={"name": "Updated"}
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated"


@pytest.mark.asyncio
class TestInviteOrganization:
    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(f"/v1/organizations/{uuid.uuid4()}", json={})

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_inviter_not_part_of_org(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        # user_organization: UserOrganization,
    ) -> None:
        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": "test@polar.sh"},
        )
        assert response.status_code == 404

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        assert set(members_after) == set(members_before)

    @pytest.mark.auth
    async def test_inviter_part_of_org(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,  # Makes this user part of the organization
    ) -> None:
        email_to_invite = "test@polar.sh"

        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": email_to_invite},
        )
        assert response.status_code == 201
        json = response.json()
        assert json["email"] == email_to_invite

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        new_members = set(members_after) - set(members_before)
        assert len(new_members) == 1
        assert list(new_members)[0].user.email == email_to_invite

    @pytest.mark.auth
    async def test_already_invited(
        self,
        client: AsyncClient,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,  # second user part of this org
    ) -> None:
        email_already_in_org = user_organization_second.user.email

        members_before = await user_organization_service.list_by_org(
            session, organization.id
        )
        assert len(members_before) == 2

        response = await client.post(
            f"/v1/organizations/{organization.id}/members/invite",
            json={"email": email_already_in_org},
        )
        assert response.status_code == 200
        json = response.json()
        assert json["email"] == email_already_in_org

        members_after = await user_organization_service.list_by_org(
            session, organization.id
        )

        assert set(members_after) == set(members_before)
        assert len(members_after) == 2


@pytest.mark.asyncio
@pytest.mark.auth
async def test_list_members(
    session: AsyncSession,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

    assert response.status_code == 200

    json = response.json()
    assert len(json["items"]) == 2


@pytest.mark.asyncio
@pytest.mark.auth
async def test_list_members_not_member(
    session: AsyncSession,
    organization: Organization,
    # user_organization: UserOrganization,  # makes User a member of Organization
    user_organization_second: UserOrganization,  # adds another member
    client: AsyncClient,
) -> None:
    response = await client.get(f"/v1/organizations/{organization.id}/members")

    assert response.status_code == 404
