import pytest
from httpx import AsyncClient

from polar.kit.utils import utc_now
from polar.kit.versioning import APIVersion
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Organization,
    Subscription,
    UserOrganization,
)
from polar.version import V2026_10, V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_member,
)


@pytest.mark.anyio
class TestListBenefitGrants:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/benefit-grants/")
        assert response.status_code == 401

    @pytest.mark.auth
    @pytest.mark.parametrize("version", [V2026_10, V2027_01])
    async def test_manual_timestamps_are_versioned(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        customer: Customer,
        user_organization: UserOrganization,
        version: APIVersion,
    ) -> None:
        now = utc_now()
        await save_fixture(
            BenefitGrant(
                benefit=benefit_organization,
                customer=customer,
                manually_granted_at=now,
                manually_revoked_at=now,
            )
        )

        response = await client.get(
            "/v1/benefit-grants/", headers={"Polar-Version": str(version)}
        )

        assert response.status_code == 200
        (grant,) = response.json()["items"]
        assert grant["granted_at"] is None
        assert grant["revoked_at"] is None
        if version == V2027_01:
            assert grant["manually_granted_at"] == now.isoformat().replace(
                "+00:00", "Z"
            )
            assert grant["manually_revoked_at"] == grant["manually_granted_at"]
        else:
            assert "manually_granted_at" not in grant
            assert "manually_revoked_at" not in grant

    @pytest.mark.auth(AuthSubjectFixture(subject="agent"))
    async def test_agent_cannot_list_benefit_grants(self, client: AsyncClient) -> None:
        response = await client.get("/v1/benefit-grants/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_active_benefit_is_not_deleted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit"]["is_deleted"] is False

    @pytest.mark.auth
    async def test_deleted_benefit_is_deleted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        benefit = await create_benefit(save_fixture, organization=organization)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            subscription=subscription,
        )
        benefit.set_deleted_at()
        await save_fixture(benefit)

        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit"]["is_deleted"] is True

    @pytest.mark.auth
    @pytest.mark.api_version(V2027_01)
    async def test_filter_by_external_benefit_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        deleted_benefit = await create_benefit(
            save_fixture, organization=organization, external_id="pro"
        )
        await create_benefit_grant(
            save_fixture, customer, deleted_benefit, granted=True
        )
        deleted_benefit.set_deleted_at()
        await save_fixture(deleted_benefit)
        benefit = await create_benefit(
            save_fixture, organization=organization, external_id="pro"
        )
        other_benefit = await create_benefit(save_fixture, organization=organization)
        grant = await create_benefit_grant(
            save_fixture, customer, benefit, granted=True
        )
        await create_benefit_grant(save_fixture, customer, other_benefit, granted=True)

        response = await client.get(
            "/v1/benefit-grants/", params={"external_benefit_id": "pro"}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(grant.id)

    @pytest.mark.auth
    @pytest.mark.api_version(V2027_01)
    async def test_filter_by_external_member_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        deleted_member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="deleted-member@example.com",
            external_id="member-1",
        )
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=deleted_member,
        )
        deleted_member.set_deleted_at()
        await save_fixture(deleted_member)
        member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member-1@example.com",
            external_id="member-1",
        )
        other_member = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="member-2@example.com",
            external_id="member-2",
        )
        grant = await create_benefit_grant(
            save_fixture, customer, benefit_organization, granted=True, member=member
        )
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=other_member,
        )

        response = await client.get(
            "/v1/benefit-grants/", params={"external_member_id": "member-1"}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(grant.id)

    @pytest.mark.auth
    async def test_filter_by_inaccessible_organization_returns_empty(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization_second: Organization,
        customer_organization_second: Customer,
    ) -> None:
        other_benefit = await create_benefit(
            save_fixture, organization=organization_second
        )
        await create_benefit_grant(
            save_fixture,
            customer_organization_second,
            other_benefit,
            granted=True,
        )

        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization_second.id)},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["items"] == []
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth
    async def test_no_filter_excludes_inaccessible_organization_grants(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
        benefit_organization: Benefit,
        customer: Customer,
        subscription: Subscription,
        organization_second: Organization,
        customer_organization_second: Customer,
    ) -> None:
        own_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )
        other_benefit = await create_benefit(
            save_fixture, organization=organization_second
        )
        await create_benefit_grant(
            save_fixture,
            customer_organization_second,
            other_benefit,
            granted=True,
        )

        response = await client.get("/v1/benefit-grants/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(own_grant.id)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_subject_cannot_access_other_org(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization_second: Organization,
        customer_organization_second: Customer,
    ) -> None:
        other_benefit = await create_benefit(
            save_fixture, organization=organization_second
        )
        await create_benefit_grant(
            save_fixture,
            customer_organization_second,
            other_benefit,
            granted=True,
        )
        response = await client.get(
            "/v1/benefit-grants/",
            params={"organization_id": str(organization_second.id)},
        )
        assert response.status_code == 200
        assert response.json()["pagination"]["total_count"] == 0


@pytest.mark.anyio
@pytest.mark.api_version(V2027_01)
class TestCreate:
    @pytest.mark.auth
    async def test_create(
        self,
        client: AsyncClient,
        customer: Customer,
        benefit_organization: Benefit,
        member_owner: Member,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/benefit-grants/",
            json={
                "customer_id": str(customer.id),
                "benefit_id": str(benefit_organization.id),
            },
        )
        assert response.status_code == 201
        grant = response.json()
        assert grant["member_id"] == str(member_owner.id)
        assert grant["manually_granted_at"] is not None

    @pytest.mark.auth
    @pytest.mark.parametrize("field", ["customer_id", "benefit_id", "member_id"])
    async def test_mixed_ids_rejected(
        self,
        client: AsyncClient,
        customer: Customer,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        field: str,
    ) -> None:
        payload = {
            "customer_id": str(customer.id),
            "benefit_id": str(benefit_organization.id),
        }
        payload[f"external_{field}"] = "external"
        response = await client.post("/v1/benefit-grants/", json=payload)
        assert response.status_code == 422


@pytest.mark.anyio
@pytest.mark.api_version(V2027_01)
class TestRevoke:
    @pytest.mark.auth
    async def test_revoke(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        customer: Customer,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture, customer, benefit_organization, granted=True, member=None
        )

        response = await client.delete(f"/v1/benefit-grants/{grant.id}")

        assert response.status_code == 200
        assert response.json()["manually_revoked_at"] is not None
