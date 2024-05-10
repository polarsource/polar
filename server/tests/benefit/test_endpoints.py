import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Benefit, Organization, UserOrganization
from polar.models.benefit import BenefitType
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestListBenefits:
    async def test_anonymous(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.get("/api/v1/benefits/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/benefits/",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_user_not_organization_member(
        self,
        client: AsyncClient,
        organization: Organization,
        benefits: list[Benefit],
    ) -> None:
        response = await client.get(
            "/api/v1/benefits/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_default}),
        AuthSubjectFixture(scopes={Scope.creator_benefits_read}),
    )
    async def test_user_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        benefits: list[Benefit],
    ) -> None:
        response = await client.get(
            "/api/v1/benefits/",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

        items = json["items"]
        assert items[0]["id"] == str(benefits[0].id)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.web_default}),
        AuthSubjectFixture(
            subject="organization", scopes={Scope.creator_benefits_read}
        ),
    )
    async def test_organization(
        self, client: AsyncClient, benefits: list[Benefit]
    ) -> None:
        response = await client.get("/api/v1/benefits/")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetBenefit:
    async def test_anonymous(
        self, client: AsyncClient, benefit_organization: Benefit
    ) -> None:
        response = await client.get(f"/api/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(f"/api/v1/benefits/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.get(f"/api/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(benefit_organization.id)
        assert "properties" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateBenefit:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/benefits/",
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
                "is_tax_applicable": True,
                "properties": {"note": None},
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single tier card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the subscription page."
                ),
            },
            {
                "is_tax_applicable": True,
                "properties": {"note": None},
                "description": "Th",
            },
            {"description": "Benefit", "properties": {"note": None}},
            {
                "type": "articles",
                "description": "My articles benefit",
                "properties": {"paid_articles": True},
            },
        ],
    )
    @pytest.mark.auth
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/benefits/",
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
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/benefits/",
            json={
                "type": "custom",
                "description": "Benefit",
                "is_tax_applicable": True,
                "properties": {"note": None},
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert "properties" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.post(
            f"/api/v1/benefits/{benefit_organization.id}",
            json={
                "type": benefit_organization.type,
                "description": "Updated Name",
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/benefits/{uuid.uuid4()}",
            json={"type": "custom", "description": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single tier card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the subscription page."
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
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/benefits/{benefit_organization.id}",
            json={"type": benefit_organization.type, **payload},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/benefits/{benefit_organization.id}",
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
    async def test_cant_update_articles_properties(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.articles,
            organization=organization,
            properties={"paid_articles": False},
        )
        response = await client.post(
            f"/api/v1/benefits/{benefit.id}",
            json={
                "type": benefit.type,
                "description": "Updated Description",
                "properties": {"paid_articles": True},
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["description"] == "Updated Description"
        assert "properties" in json
        assert json["properties"]["paid_articles"] is False

    @pytest.mark.auth
    async def test_can_update_custom_properties(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            organization=organization,
            properties={"note": "NOTE"},
        )

        response = await client.post(
            f"/api/v1/benefits/{benefit.id}",
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
@pytest.mark.http_auto_expunge
class TestDeleteBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.delete(f"/api/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(f"/api/v1/benefits/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        benefit_organization: Benefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.delete(f"/api/v1/benefits/{benefit_organization.id}")

        assert response.status_code == 204
