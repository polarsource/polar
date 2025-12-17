import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import (
    Benefit,
    Customer,
    Member,
    Organization,
    Subscription,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant


@pytest.mark.asyncio
class TestListBenefits:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/benefits/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self, client: AsyncClient, benefits: list[Benefit]
    ) -> None:
        response = await client.get("/v1/benefits/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_read}),
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        response = await client.get("/v1/benefits/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.web_read}),
        AuthSubjectFixture(subject="organization", scopes={Scope.benefits_read}),
    )
    async def test_organization(
        self, client: AsyncClient, benefits: list[Benefit]
    ) -> None:
        response = await client.get("/v1/benefits/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3


@pytest.mark.asyncio
class TestListBenefitsFilters:
    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_id_filter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        ids_to_include = [str(benefits[0].id), str(benefits[1].id)]
        response = await client.get(
            "/v1/benefits/",
            params={"id": ids_to_include},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        returned_ids = {item["id"] for item in json["items"]}
        assert returned_ids == set(ids_to_include)

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_exclude_id_filter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        ids_to_exclude = [str(benefits[0].id)]
        response = await client.get(
            "/v1/benefits/",
            params={"exclude_id": ids_to_exclude},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 2
        returned_ids = {item["id"] for item in json["items"]}
        assert str(benefits[0].id) not in returned_ids
        assert str(benefits[1].id) in returned_ids
        assert str(benefits[2].id) in returned_ids

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_user_order_sorting(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        ordered_ids = [str(benefits[2].id), str(benefits[0].id), str(benefits[1].id)]
        response = await client.get(
            "/v1/benefits/",
            params={
                "id": ordered_ids,
                "sorting": ["user_order"],
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3
        returned_ids = [item["id"] for item in json["items"]]
        assert returned_ids == ordered_ids

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_user_order_sorting_descending(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        ordered_ids = [str(benefits[0].id), str(benefits[1].id), str(benefits[2].id)]
        response = await client.get(
            "/v1/benefits/",
            params={
                "id": ordered_ids,
                "sorting": ["-user_order"],
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3
        returned_ids = [item["id"] for item in json["items"]]
        assert returned_ids == list(reversed(ordered_ids))

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_user_order_without_id_falls_back_to_default(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        response = await client.get(
            "/v1/benefits/",
            params={"sorting": ["user_order"]},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.benefits_read}),
    )
    async def test_combined_id_and_exclude_id(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        response = await client.get(
            "/v1/benefits/",
            params={
                "id": [str(benefits[0].id), str(benefits[1].id)],
                "exclude_id": [str(benefits[0].id)],
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(benefits[1].id)


@pytest.mark.asyncio
class TestGetBenefit:
    async def test_anonymous(
        self, client: AsyncClient, benefit_organization: Benefit
    ) -> None:
        response = await client.get(f"/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/benefits/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(f"/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(benefit_organization.id)
        assert "properties" in json


@pytest.mark.asyncio
class TestCreateBenefit:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/benefits/",
            json={
                "type": "custom",
                "description": "Benefit",
                "properties": {"note": None},
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.parametrize(
        "payload",
        [
            {
                "properties": {"note": None},
                "description": (
                    "This is just a simple benefit description that should not be allowed because it's too long"
                ),
            },
            {
                "properties": {"note": None},
                "description": "Th",
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/benefits/",
            json={
                "type": "custom",
                "organization_id": str(organization.id),
                **payload,
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/benefits/",
            json={
                "type": "custom",
                "description": "Benefit",
                "properties": {"note": None},
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "properties" in json


@pytest.mark.asyncio
class TestUpdateBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.patch(
            f"/v1/benefits/{benefit_organization.id}",
            json={
                "type": benefit_organization.type,
                "description": "Updated Name",
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/benefits/{uuid.uuid4()}",
            json={"type": "custom", "description": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {
                "description": (
                    "This is just a simple product description that should be allowed"
                )
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/benefits/{benefit_organization.id}",
            json={"type": benefit_organization.type, **payload},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.patch(
            f"/v1/benefits/{benefit_organization.id}",
            json={
                "type": benefit_organization.type,
                "description": "Updated Description",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["description"] == "Updated Description"
        assert "properties" in json

    @pytest.mark.auth
    async def test_can_update_custom_properties(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            organization=organization,
            properties={"note": "NOTE"},
        )

        response = await client.patch(
            f"/v1/benefits/{benefit.id}",
            json={
                "type": benefit.type,
                "description": "Updated Description",
                "properties": {"note": "UPDATED NOTE"},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["description"] == "Updated Description"
        assert "properties" in json
        assert json["properties"]["note"] == "UPDATED NOTE"


@pytest.mark.asyncio
class TestDeleteBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.delete(f"/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/benefits/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.delete(f"/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 204


@pytest.mark.asyncio
class TestViewGrants:
    async def test_anonymous(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(
            f"/v1/benefits/{uuid.uuid4()}/grants",
        )

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_empty_grants(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 200

        json = response.json()
        assert json["items"] == []

    @pytest.mark.auth
    async def test_with_granted_grants(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 1

        granted_item = json["items"][0]
        assert granted_item["id"] == str(grant.id)
        assert granted_item["is_granted"] is True
        assert granted_item["granted_at"] is not None
        assert granted_item["is_revoked"] is False
        assert granted_item["revoked_at"] is None
        assert granted_item["customer_id"] == str(customer.id)
        assert granted_item["benefit_id"] == str(benefit_organization.id)
        assert granted_item["subscription_id"] == str(subscription.id)
        assert granted_item["error"] is None

    @pytest.mark.auth
    async def test_with_revoked_grants(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        revoked_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=False,
            subscription=subscription,
        )

        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 1

        revoked_item = json["items"][0]
        assert revoked_item["id"] == str(revoked_grant.id)
        assert revoked_item["is_granted"] is False
        assert revoked_item["granted_at"] is None
        assert revoked_item["is_revoked"] is True
        assert revoked_item["revoked_at"] is not None
        assert revoked_item["customer_id"] == str(customer.id)
        assert revoked_item["benefit_id"] == str(benefit_organization.id)
        assert revoked_item["subscription_id"] == str(subscription.id)
        assert revoked_item["error"] is None

    @pytest.mark.auth
    async def test_with_errored_grants(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        customer: Customer,
        subscription: Subscription,
    ) -> None:
        error_grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            subscription=subscription,
        )
        error_message = "Test error message"
        error_grant.set_grant_failed(Exception(error_message))
        await save_fixture(error_grant)

        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 1

        error_item = json["items"][0]
        assert error_item["id"] == str(error_grant.id)
        assert error_item["is_granted"] is False
        assert error_item["granted_at"] is None
        assert error_item["is_revoked"] is False
        assert error_item["error"] is not None
        assert error_item["error"]["message"] == error_message
        assert error_item["error"]["type"] == "Exception"
        assert "timestamp" in error_item["error"]

    @pytest.mark.auth
    async def test_with_member_id_filter(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        member1 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member1@example.com",
            name="Member 1",
            role="member",
        )
        await save_fixture(member1)

        member2 = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member2@example.com",
            name="Member 2",
            role="member",
        )
        await save_fixture(member2)

        grant_with_member1 = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member1,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member2,
            subscription=subscription,
        )

        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
            params={"member_id": str(member1.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 1
        assert json["items"][0]["id"] == str(grant_with_member1.id)
        assert json["items"][0]["member_id"] == str(member1.id)

    @pytest.mark.auth
    async def test_member_id_in_response(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        benefit_organization: Benefit,
        user_organization: UserOrganization,
        customer: Customer,
        organization: Organization,
        subscription: Subscription,
    ) -> None:
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role="member",
        )
        await save_fixture(member)

        grant_with_member = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            member=member,
            subscription=subscription,
        )

        grant_without_member = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(
            f"/v1/benefits/{benefit_organization.id}/grants",
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["items"]) == 2

        items_by_id = {item["id"]: item for item in json["items"]}
        assert items_by_id[str(grant_with_member.id)]["member_id"] == str(member.id)
        assert items_by_id[str(grant_without_member.id)]["member_id"] is None
