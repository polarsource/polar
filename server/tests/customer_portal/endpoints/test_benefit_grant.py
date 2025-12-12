import pytest
from httpx import AsyncClient

from polar.models import Benefit, Customer, Member, Organization, Subscription
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit_grant


@pytest.mark.asyncio
class TestListBenefitGrants:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_customer(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        await create_benefit_grant(
            save_fixture,
            customer_second,
            benefit_organization_second,
            granted=False,
            subscription=subscription,
        )

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_filter_by_member_id(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        organization: Organization,
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

        grant1 = await create_benefit_grant(
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
            "/v1/customer-portal/benefit-grants/",
            params={"member_id": str(member1.id)},
        )

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(grant1.id)
        assert json["items"][0]["member_id"] == str(member1.id)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_member_id_in_response(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
        organization: Organization,
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

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(grant_with_member.id)
        assert json["items"][0]["member_id"] == str(member.id)
