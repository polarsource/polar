import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.models import Product, User
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


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


@pytest.mark.asyncio
class TestGetPaymentStatus:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid_no_steps_complete(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        await save_fixture(organization)

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["payment_ready"] is False
        assert len(json["steps"]) == 3

        # All steps should be incomplete
        for step in json["steps"]:
            assert step["completed"] is False

        # Check specific steps exist
        step_ids = [step["id"] for step in json["steps"]]
        assert "create_product" in step_ids
        assert "integrate_api" in step_ids
        assert "setup_account" in step_ids

    @pytest.mark.auth
    async def test_valid_with_product(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        await save_fixture(organization)

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["payment_ready"] is False

        # Product step should be complete
        product_step = next(s for s in json["steps"] if s["id"] == "create_product")
        assert product_step["completed"] is True

    @pytest.mark.auth
    async def test_valid_with_api_key(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        mocker: MockerFixture,
    ) -> None:
        # Make this a new organization (not grandfathered)
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        await save_fixture(organization)

        # Mock the API key count
        mocker.patch(
            "polar.organization_access_token.repository.OrganizationAccessTokenRepository.count_by_organization_id",
            return_value=1,  # Has 1 API key
        )

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["payment_ready"] is False

        # API integration step should be complete
        api_step = next(s for s in json["steps"] if s["id"] == "integrate_api")
        assert api_step["completed"] is True

    @pytest.mark.auth
    async def test_valid_grandfathered_organization(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # Make organization grandfathered
        organization.created_at = datetime(2025, 7, 29, tzinfo=UTC)
        await save_fixture(organization)

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        # Should be payment ready even without completing steps
        assert json["payment_ready"] is True

    @pytest.mark.auth
    async def test_valid_all_steps_complete(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        product: Product,
        mocker: MockerFixture,
        user: User,
    ) -> None:
        # Set up as new organization
        organization.created_at = datetime(2025, 8, 1, tzinfo=UTC)
        organization.status = Organization.Status.ACTIVE
        organization.details_submitted_at = datetime.now(UTC)
        organization.details = {"about": "Test"}  # type: ignore

        # Set up user verification
        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        # Set up account (only checking is_details_submitted now)
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            country="US",
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=False,  # Can be false
            is_payouts_enabled=False,  # Can be false
            stripe_id="STRIPE_ACCOUNT_ID",
        )
        await save_fixture(account)

        organization.account = account
        organization.account_id = account.id
        await save_fixture(organization)

        # Mock the API key count
        mocker.patch(
            "polar.organization_access_token.repository.OrganizationAccessTokenRepository.count_by_organization_id",
            return_value=1,  # Has 1 API key
        )

        response = await client.get(
            f"/v1/organizations/{organization.id}/payment-status"
        )
        assert response.status_code == 200

        json = response.json()
        assert json["payment_ready"] is True

        # All steps should be complete
        for step in json["steps"]:
            assert step["completed"] is True
