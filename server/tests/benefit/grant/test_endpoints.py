from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Organization,
    Subscription,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_benefit_grant,
    create_manual_grant,
)


@pytest.mark.asyncio
class TestListBenefitGrants:
    async def test_anonymous(self, client: AsyncClient) -> None:
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


@pytest.mark.asyncio
class TestCreateBenefitGrant:
    async def test_anonymous(
        self,
        client: AsyncClient,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        response = await client.post(
            "/v1/benefit-grants/",
            json={
                "customer_id": str(customer.id),
                "benefit_ids": [str(benefit_organization.id)],
            },
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_returns_persisted_pending_grant(
        self,
        client: AsyncClient,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
        expires_at = datetime.now(UTC) + timedelta(days=7)

        response = await client.post(
            "/v1/benefit-grants/",
            json={
                "customer_id": str(customer.id),
                "benefit_ids": [str(benefit_organization.id)],
                "expires_at": expires_at.isoformat(),
                "reason": "Customer success exception",
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert len(json["items"]) == 1
        grant = json["items"][0]
        assert grant["customer_id"] == str(customer.id)
        assert grant["benefit_id"] == str(benefit_organization.id)
        assert grant["manual_grant"] is not None
        assert grant["manual_grant"]["reason"] == "Customer success exception"
        assert grant["manual_grant"]["expires_at"] is not None
        assert grant["is_granted"] is False
        assert grant["is_revoked"] is False
        enqueue_mock.assert_called_once_with(
            "benefit.grant",
            customer_id=customer.id,
            benefit_id=benefit_organization.id,
            member_id=mocker.ANY,
            manual_grant_id=mocker.ANY,
        )

    @pytest.mark.auth
    async def test_multiple_benefits_share_manual_grant(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        session: AsyncSession,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")
        other_benefit = await create_benefit(save_fixture, organization=organization)

        response = await client.post(
            "/v1/benefit-grants/",
            json={
                "customer_id": str(customer.id),
                "benefit_ids": [
                    str(benefit_organization.id),
                    str(other_benefit.id),
                ],
                "reason": "Customer success exception",
            },
        )

        assert response.status_code == 201
        items = response.json()["items"]
        assert {grant["benefit_id"] for grant in items} == {
            str(benefit_organization.id),
            str(other_benefit.id),
        }
        assert {grant["manual_grant"]["id"] for grant in items} == {
            items[0]["manual_grant"]["id"]
        }
        grants = (
            (
                await session.execute(
                    select(BenefitGrant).where(
                        BenefitGrant.id.in_([UUID(grant["id"]) for grant in items])
                    )
                )
            )
            .scalars()
            .all()
        )
        assert {grant.manual_grant_id for grant in grants} == {
            grants[0].manual_grant_id
        }
        assert enqueue_mock.call_count == 2

    @pytest.mark.auth
    async def test_already_manually_granted(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        existing = await create_manual_grant(save_fixture, customer=customer)
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=existing,
        )

        response = await client.post(
            "/v1/benefit-grants/",
            json={
                "customer_id": str(customer.id),
                "benefit_ids": [str(benefit_organization.id)],
            },
        )

        assert response.status_code == 422


@pytest.mark.asyncio
class TestRevokeBenefitGrant:
    @pytest.mark.auth
    async def test_returns_revoking_grant(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
    ) -> None:
        manual_grant = await create_manual_grant(save_fixture, customer=customer)
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            manual_grant=manual_grant,
        )
        enqueue_mock = mocker.patch("polar.benefit.grant.manual.service.enqueue_job")

        response = await client.delete(f"/v1/benefit-grants/{grant.id}")
        duplicate_response = await client.delete(f"/v1/benefit-grants/{grant.id}")

        assert response.status_code == 202
        assert response.json()["is_granted"] is True
        assert response.json()["is_revoked"] is False
        assert duplicate_response.status_code == 202
        assert duplicate_response.json()["is_revoked"] is False
        # Duplicate DELETE before the worker runs may enqueue again; revoke is idempotent.
        assert enqueue_mock.call_count == 2
        enqueue_mock.assert_called_with(
            "benefit.revoke",
            customer_id=grant.customer_id,
            benefit_id=grant.benefit_id,
            member_id=grant.member_id,
            manual_grant_id=manual_grant.id,
        )

    @pytest.mark.auth
    async def test_rejects_purchase_grant(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        user_organization: UserOrganization,
        customer: Customer,
        benefit_organization: Benefit,
        subscription: Subscription,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.delete(f"/v1/benefit-grants/{grant.id}")

        assert response.status_code == 404
