import uuid

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models import Benefit, Customer, Organization, UserOrganization
from polar.models.benefit import BenefitType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_customer,
    create_manual_grant,
)


@pytest.mark.asyncio
class TestCreateManualGrant:
    async def test_anonymous(
        self, client: AsyncClient, customer: Customer, benefit_organization: Benefit
    ) -> None:
        response = await client.post(
            "/v1/manual-grants/",
            json={
                "customer_id": str(customer.id),
                "grants": [{"benefit_id": str(benefit_organization.id)}],
            },
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        mocker.patch("polar.benefit.manual_grant.service.enqueue_job")

        response = await client.post(
            "/v1/manual-grants/",
            json={
                "customer_id": str(customer.id),
                "grants": [{"benefit_id": str(benefit_organization.id)}],
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["customer_id"] == str(customer.id)
        assert json["grants"] == []

    @pytest.mark.auth
    async def test_ineligible_type(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
    ) -> None:
        benefit = await create_benefit(
            save_fixture, organization=organization, type=BenefitType.meter_credit
        )

        response = await client.post(
            "/v1/manual-grants/",
            json={
                "customer_id": str(customer.id),
                "grants": [{"benefit_id": str(benefit.id)}],
            },
        )

        assert response.status_code == 422

    @pytest.mark.auth
    async def test_empty_grants(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        response = await client.post(
            "/v1/manual-grants/",
            json={"customer_id": str(customer.id), "grants": []},
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestRevokeGrant:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        enqueue_mock = mocker.patch("polar.benefit.manual_grant.service.enqueue_job")
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )

        response = await client.post(
            f"/v1/manual-grants/{manual_grant.id}/grants/{grant.id}/revoke"
        )

        assert response.status_code == 200
        assert response.json()["id"] == str(manual_grant.id)
        enqueue_mock.assert_called_once()

    @pytest.mark.auth
    async def test_grant_not_found(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)

        response = await client.post(
            f"/v1/manual-grants/{manual_grant.id}/grants/{uuid.uuid4()}/revoke"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_manual_grant_not_found(
        self, client: AsyncClient, user_organization: UserOrganization
    ) -> None:
        response = await client.post(
            f"/v1/manual-grants/{uuid.uuid4()}/grants/{uuid.uuid4()}/revoke"
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestGetManualGrant:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)

        response = await client.get(f"/v1/manual-grants/{manual_grant.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(manual_grant.id)

    @pytest.mark.auth
    async def test_not_accessible(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        organization_second: Organization,
    ) -> None:

        other_customer = await create_customer(
            save_fixture, organization=organization_second
        )
        manual_grant = await create_manual_grant(save_fixture, customer=other_customer)

        response = await client.get(f"/v1/manual-grants/{manual_grant.id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestListManualGrants:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/manual-grants/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_org_scoped(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
        organization_second: Organization,
    ) -> None:

        await create_manual_grant(save_fixture, customer=customer)
        other_customer = await create_customer(
            save_fixture, organization=organization_second
        )
        await create_manual_grant(save_fixture, customer=other_customer)

        response = await client.get("/v1/manual-grants/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["customer_id"] == str(customer.id)
