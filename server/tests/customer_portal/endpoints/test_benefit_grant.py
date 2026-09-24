import pytest
from httpx import AsyncClient

from polar.kit.visibility import Visibility
from polar.models import (
    Benefit,
    BenefitGrant,
    Customer,
    Member,
    Organization,
    Subscription,
)
from polar.models.benefit import BenefitType
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from tests.fixtures.auth import CUSTOMER_AUTH_SUBJECT
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit, create_benefit_grant


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
    async def test_excludes_non_public_benefits(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        benefit_organization_second.visibility = Visibility.private
        await save_fixture(benefit_organization_second)

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_second,
            granted=True,
            subscription=subscription,
        )

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit_id"] == str(benefit_organization.id)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_excludes_draft_benefits(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        customer: Customer,
    ) -> None:
        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        benefit_organization_second.visibility = Visibility.draft
        await save_fixture(benefit_organization_second)

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization_second,
            granted=True,
            subscription=subscription,
        )

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert len(json["items"]) == 1
        assert json["items"][0]["benefit_id"] == str(benefit_organization.id)

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

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_member_oauth_accounts_in_response(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.github_repository,
            properties={
                "repository_owner": "test-owner",
                "repository_name": "test-repo",
                "permission": "pull",
            },
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role="member",
            _oauth_accounts={},
        )
        member.set_oauth_account(
            CustomerOAuthAccount(
                access_token="member-token",
                account_id="11111",
                account_username="member-github-user",
            ),
            CustomerOAuthPlatform.github,
        )
        await save_fixture(member)

        await create_benefit_grant(
            save_fixture,
            customer,
            benefit,
            granted=True,
            member=member,
            subscription=subscription,
        )

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["member"] == {
            "id": str(member.id),
            "oauth_accounts": {
                "github:11111": {
                    "account_id": "11111",
                    "account_username": "member-github-user",
                }
            },
        }

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_deleted_member_oauth_accounts_hidden(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        customer: Customer,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.github_repository,
            properties={
                "repository_owner": "test-owner",
                "repository_name": "test-repo",
                "permission": "pull",
            },
        )
        member = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="member@example.com",
            name="Member",
            role="member",
            _oauth_accounts={},
        )
        member.set_oauth_account(
            CustomerOAuthAccount(
                access_token="member-token",
                account_id="11111",
                account_username="member-github-user",
            ),
            CustomerOAuthPlatform.github,
        )
        member.set_deleted_at()
        await save_fixture(member)

        grant = BenefitGrant(
            customer=customer, benefit=benefit, member=member, subscription=subscription
        )
        grant.set_grant_failed(Exception("OAuth account missing"))
        await save_fixture(grant)

        response = await client.get("/v1/customer-portal/benefit-grants/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["member"] is None

        response = await client.get(f"/v1/customer-portal/benefit-grants/{grant.id}")

        assert response.status_code == 200
        assert response.json()["member"] is None


@pytest.mark.asyncio
class TestGetBenefitGrant:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_public_benefit(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(f"/v1/customer-portal/benefit-grants/{grant.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(grant.id)

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_private_benefit_not_found(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        benefit_organization.visibility = Visibility.private
        await save_fixture(benefit_organization)

        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(f"/v1/customer-portal/benefit-grants/{grant.id}")

        assert response.status_code == 404

    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_draft_benefit_not_found(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        benefit_organization.visibility = Visibility.draft
        await save_fixture(benefit_organization)

        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.get(f"/v1/customer-portal/benefit-grants/{grant.id}")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateBenefitGrant:
    @pytest.mark.auth(CUSTOMER_AUTH_SUBJECT)
    async def test_private_benefit_not_found(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        subscription: Subscription,
        benefit_organization: Benefit,
        customer: Customer,
    ) -> None:
        benefit_organization.visibility = Visibility.private
        await save_fixture(benefit_organization)

        grant = await create_benefit_grant(
            save_fixture,
            customer,
            benefit_organization,
            granted=True,
            subscription=subscription,
        )

        response = await client.patch(
            f"/v1/customer-portal/benefit-grants/{grant.id}",
            json={"benefit_type": "custom"},
        )

        assert response.status_code == 404
