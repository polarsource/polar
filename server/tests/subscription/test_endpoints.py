import uuid
from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from polar.config import settings
from polar.models import (
    Organization,
    Repository,
    Subscription,
    SubscriptionBenefit,
    SubscriptionTier,
    User,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.postgres import AsyncSession
from polar.subscription.service.subscription_benefit import (
    subscription_benefit as subscription_benefit_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_subscription_benefits,
    create_active_subscription,
    create_organization,
    create_subscription_benefit,
    create_subscription_tier,
)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchSubscriptionTiers:
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    async def test_anonymous_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

        items = json["items"]
        assert items[0]["id"] == str(subscription_tiers[0].id)
        assert items[1]["id"] == str(subscription_tiers[1].id)
        assert items[2]["id"] == str(subscription_tiers[2].id)

    async def test_anonymous_indirect_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 4

        items = json["items"]
        assert items[0]["id"] == str(subscription_tiers[0].id)
        assert items[1]["id"] == str(subscription_tiers[1].id)
        assert items[2]["id"] == str(subscription_tiers[2].id)

    async def test_anonymous_public_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        subscription_tiers: list[SubscriptionTier],
        session: AsyncSession,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": public_repository.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert items[0]["repository_id"] == str(public_repository.id)

    async def test_anonymous_private_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        repository: Repository,
        subscription_tiers: list[SubscriptionTier],
        session: AsyncSession,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": repository.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    async def test_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        item = items[0]
        assert item["id"] == str(subscription_tier_organization.id)
        assert len(item["benefits"]) == len(subscription_benefits)
        for benefit in item["benefits"]:
            assert "properties" not in benefit
            assert "is_tax_applicable" not in benefit


@pytest.mark.asyncio
class TestLookupSubscriptionTier:
    @pytest.mark.http_auto_expunge
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/lookup",
            params={"subscription_tier_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    @pytest.mark.http_auto_expunge
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/tiers/lookup",
            params={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription_tier_organization.id)

    async def test_valid_with_benefits(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        subscription_tier_organization = await add_subscription_benefits(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            subscription_benefits=subscription_benefits,
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/api/v1/subscriptions/tiers/lookup",
            params={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription_tier_organization.id)
        assert len(json["benefits"]) == len(subscription_benefits)
        for benefit in json["benefits"]:
            assert "properties" not in benefit
            assert "is_tax_applicable" not in benefit


@pytest.mark.asyncio
class TestCreateSubscriptionTier:
    @pytest.mark.http_auto_expunge
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "individual",
                "name": "Subscription Tier",
                "price_amount": 1000,
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    @pytest.mark.http_auto_expunge
    async def test_both_organization_and_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "individual",
                "name": "Subscription Tier",
                "price_amount": 1000,
                "organization_id": str(organization.id),
                "repository_id": str(public_repository.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    @pytest.mark.http_auto_expunge
    async def test_neither_organization_nor_repository(
        self,
        client: AsyncClient,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "individual",
                "name": "Subscription Tier",
                "price_amount": 1000,
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    @pytest.mark.http_auto_expunge
    async def test_cant_create_free_type_tier(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "free",
                "name": "Subscription Tier",
                "price_amount": 1000,
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "This is a way too long name for a subscription tier"},
            {"name": "ab"},
            {"name": ""},
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single subscription tier card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the subscription page."
                )
            },
        ],
    )
    @pytest.mark.authenticated
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        # then
        session.expunge_all()

        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "individual",
                "name": "Subscription Tier",
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "recurring_interval": "month",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
                **payload,
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
        session: AsyncSession,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        # then
        session.expunge_all()

        response = await client.post(
            "/api/v1/subscriptions/tiers/",
            json={
                "type": "individual",
                "name": "Subscription Tier",
                "price_amount": 1000,
                "organization_id": str(organization.id),
                "prices": [
                    {
                        "recurring_interval": "month",
                        "price_amount": 1000,
                        "price_currency": "usd",
                    }
                ],
            },
        )

        assert response.status_code == 201


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateSubscriptionTier:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        session: AsyncSession,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(
        self,
        client: AsyncClient,
        session: AsyncSession,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{uuid.uuid4()}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {"name": "This is a way too long name for a subscription tier"},
            {"name": "ab"},
            {"name": ""},
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single subscription tier card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the subscription page."
                )
            },
        ],
    )
    @pytest.mark.authenticated
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}",
            json=payload,
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}",
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200

        json = response.json()
        assert json["name"] == "Updated Name"


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpdateSubscriptionTierBenefits:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{uuid.uuid4()}/benefits",
            json={"benefits": []},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/benefits",
            json={"benefits": [str(subscription_benefit_organization.id)]},
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["benefits"]) == 1


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestArchiveSubscriptionTier:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/archive"
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{uuid.uuid4()}/archive"
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/archive"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["is_archived"]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchSubscriptionBenefits:
    async def test_anonymous(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.get("/api/v1/subscriptions/benefits/search")

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_existing_repository(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_user_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.authenticated
    async def test_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert items[0]["id"] == str(subscription_benefits[0].id)

    @pytest.mark.authenticated
    async def test_indirect_organization(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 3

    @pytest.mark.authenticated
    async def test_public_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        user_organization: UserOrganization,
        subscription_benefits: list[SubscriptionBenefit],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": public_repository.name,
                "direct_organization": False,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1

        items = json["items"]
        assert items[0]["repository_id"] == str(public_repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestLookupSubscriptionBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/lookup",
            params={
                "subscription_benefit_id": str(subscription_benefit_organization.id)
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/lookup",
            params={"subscription_benefit_id": str(uuid.uuid4())},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/benefits/lookup",
            params={
                "subscription_benefit_id": str(subscription_benefit_organization.id)
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription_benefit_organization.id)
        assert "properties" in json


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateSubscriptionBenefit:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "description": "Subscription Benefit",
                "properties": {"note": None},
                "organization_id": str(uuid.uuid4()),
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_both_organization_and_repository(
        self,
        client: AsyncClient,
        organization: Organization,
        public_repository: Repository,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "description": "Subscription Benefit",
                "properties": {"note": None},
                "organization_id": str(organization.id),
                "repository_id": str(public_repository.id),
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_neither_organization_nor_repository(
        self,
        client: AsyncClient,
        user_organization_admin: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "description": "Subscription Benefit",
                "properties": {"note": None},
            },
        )

        assert response.status_code == 422

    @pytest.mark.parametrize(
        "payload",
        [
            {
                "is_tax_applicable": True,
                "properties": {"note": None},
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single subscription benefit card. "
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
            {"description": "Subscription Benefit", "properties": {"note": None}},
            {
                "type": "articles",
                "description": "My articles benefit",
                "properties": {"paid_articles": True},
            },
        ],
    )
    @pytest.mark.authenticated
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "organization_id": str(organization.id),
                **payload,
            },
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "description": "Subscription Benefit",
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
class TestUpdateSubscriptionBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/benefits/{subscription_benefit_organization.id}",
            json={
                "type": subscription_benefit_organization.type,
                "description": "Updated Name",
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/benefits/{uuid.uuid4()}",
            json={"type": "custom", "description": "Updated Name"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize(
        "payload",
        [
            {
                "description": (
                    "This is a way too long description that shall never fit "
                    "in the space we have in a single subscription benefit card. "
                    "That's why we need to add this upper limit of characters, "
                    "otherwise users would put loads and loads of text that would "
                    "result in a very ugly output on the subscription page."
                )
            },
        ],
    )
    @pytest.mark.authenticated
    async def test_validation(
        self,
        payload: dict[str, Any],
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/benefits/{subscription_benefit_organization.id}",
            json={"type": subscription_benefit_organization.type, **payload},
        )

        assert response.status_code == 422

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/benefits/{subscription_benefit_organization.id}",
            json={
                "type": subscription_benefit_organization.type,
                "description": "Updated Description",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["description"] == "Updated Description"
        assert "properties" in json

    @pytest.mark.authenticated
    async def test_cant_update_articles_properties(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.articles,
            organization=organization,
            properties={"paid_articles": False},
        )
        response = await client.post(
            f"/api/v1/subscriptions/benefits/{benefit.id}",
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

    @pytest.mark.authenticated
    async def test_can_update_custom_properties(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
    ) -> None:
        benefit = await create_subscription_benefit(
            save_fixture,
            type=SubscriptionBenefitType.custom,
            organization=organization,
            properties={"note": "NOTE"},
        )

        response = await client.post(
            f"/api/v1/subscriptions/benefits/{benefit.id}",
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
class TestDeleteSubscriptionBenefit:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
    ) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/benefits/{subscription_benefit_organization.id}"
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(f"/api/v1/subscriptions/benefits/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription_benefit_organization: SubscriptionBenefit,
        user_organization_admin: UserOrganization,
    ) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/benefits/{subscription_benefit_organization.id}"
        )

        assert response.status_code == 204


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateSubscribeSession:
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={"tier_id": str(uuid.uuid4()), "success_url": "https://polar.sh"},
        )

        assert response.status_code == 404

    @pytest.mark.parametrize("success_url", [None, "INVALID_URL"])
    async def test_missing_invalid_success_url(
        self,
        success_url: str | None,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        json = {"tier_id": str(subscription_tier_organization.id)}
        if success_url is not None:
            json["success_url"] = success_url

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/", json=json
        )

        assert response.status_code == 422

    async def test_invalid_customer_email(
        self, client: AsyncClient, subscription_tier_organization: SubscriptionTier
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_organization.id),
                "success_url": "https://polar.sh",
                "customer_email": "INVALID_EMAIL",
            },
        )

        assert response.status_code == 422

    async def test_anonymous_subscription_tier_organization(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_organization.id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["subscription_tier"]["id"] == str(subscription_tier_organization.id)

    async def test_anonymous_subscription_tier_repository(
        self,
        client: AsyncClient,
        subscription_tier_repository: SubscriptionTier,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_subscription_checkout_session_mock: (
            MagicMock
        ) = stripe_service_mock.create_subscription_checkout_session
        create_subscription_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        response = await client.post(
            "/api/v1/subscriptions/subscribe-sessions/",
            json={
                "tier_id": str(subscription_tier_repository.id),
                "success_url": "https://polar.sh",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["subscription_tier"]["id"] == str(subscription_tier_repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetSubscribeSession:
    async def test_valid_subscription_tier_organization(
        self,
        client: AsyncClient,
        subscription_tier_organization: SubscriptionTier,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={"subscription_tier_id": str(subscription_tier_organization.id)},
        )

        response = await client.get(
            "/api/v1/subscriptions/subscribe-sessions/SESSION_ID"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["customer_name"] == "John"
        assert json["customer_email"] == "backer@example.com"
        assert json["subscription_tier"]["id"] == str(subscription_tier_organization.id)

    async def test_valid_subscription_tier_repository(
        self,
        client: AsyncClient,
        subscription_tier_repository: SubscriptionTier,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={"subscription_tier_id": str(subscription_tier_repository.id)},
        )

        response = await client.get(
            "/api/v1/subscriptions/subscribe-sessions/SESSION_ID"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == "SESSION_ID"
        assert json["url"] == "STRIPE_URL"
        assert json["customer_name"] == "John"
        assert json["customer_email"] == "backer@example.com"
        assert json["subscription_tier"]["id"] == str(subscription_tier_repository.id)


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchSubscriptions:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/api/v1/subscriptions/subscriptions/search")

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/search",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/search",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert "github_username" in item["user"]
            assert "email" in item["user"]


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestSearchSubscribedSubscriptions:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/api/v1/subscriptions/subscriptions/subscribed")

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/subscribed",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/subscribed",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        response = await client.get("/api/v1/subscriptions/subscriptions/subscribed")

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" not in item

    @pytest.mark.authenticated
    async def test_with_multiple_subscriptions(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        organization: Organization,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # subscribe to multiple orgs
        for _ in range(3):
            org1 = await create_organization(save_fixture)
            sub1 = await create_subscription_tier(save_fixture, organization=org1)
            await create_active_subscription(
                save_fixture,
                subscription_tier=sub1,
                user=user,
                started_at=datetime(2023, 1, 1),
                ended_at=datetime(2023, 6, 15),
            )

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/subscribed",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" not in item


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestCreateFreeSubscription:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription_tier_organization_free: SubscriptionTier,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/subscriptions/",
            json={
                "tier_id": str(subscription_tier_organization_free.id),
                "customer_email": "backer@example.com",
            },
        )

        assert response.status_code == 201

        json = response.json()
        assert json["subscription_tier_id"] == str(
            subscription_tier_organization_free.id
        )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestUpgradeSubscription:
    async def test_anonymous(
        self,
        client: AsyncClient,
        subscription: Subscription,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}",
            json={
                "subscription_tier_id": str(subscription_tier_organization_second.id)
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing(
        self,
        client: AsyncClient,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{uuid.uuid4()}",
            json={
                "subscription_tier_id": str(subscription_tier_organization_second.id)
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        subscription: Subscription,
        subscription_tier_organization_second: SubscriptionTier,
    ) -> None:
        response = await client.post(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}",
            json={
                "subscription_tier_id": str(subscription_tier_organization_second.id)
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription.id)


@pytest.mark.asyncio
class TestCancelSubscription:
    @pytest.mark.http_auto_expunge
    async def test_anonymous(
        self, client: AsyncClient, subscription: Subscription
    ) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}"
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    @pytest.mark.http_auto_expunge
    async def test_not_existing(self, client: AsyncClient) -> None:
        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{uuid.uuid4()}"
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        subscription: Subscription,
    ) -> None:
        subscription.status = SubscriptionStatus.active
        await save_fixture(subscription)

        # then
        session.expunge_all()

        response = await client.delete(
            f"/api/v1/subscriptions/subscriptions/{subscription.id}"
        )

        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(subscription.id)


@pytest.mark.asyncio
class TestSearchSubscriptionsSummary:
    @pytest.mark.http_auto_expunge
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/summary",
            params={"platform": "github", "organization_name": "not_existing"},
        )

        assert response.status_code == 404

    @pytest.mark.http_auto_expunge
    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/summary",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
            },
        )

        assert response.status_code == 404

    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        subscription_tier_organization: SubscriptionTier,
    ) -> None:
        await create_active_subscription(
            save_fixture,
            subscription_tier=subscription_tier_organization,
            user=user,
            started_at=datetime(2023, 1, 1),
            ended_at=datetime(2023, 6, 15),
        )

        # then
        session.expunge_all()

        response = await client.get(
            "/api/v1/subscriptions/subscriptions/summary",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
            },
        )

        assert response.status_code == 200
        json = response.json()

        assert json["pagination"]["total_count"] == 1
        for item in json["items"]:
            assert "user" in item
            assert item["user"]["public_name"] != user.email
            assert "email" not in item["user"]
            assert "subscription_tier" in item
            assert item["subscription_tier"]["id"] == str(
                subscription_tier_organization.id
            )
            assert "status" not in item
            assert "price_amount" not in item


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestGetSubscriptionsStatistics:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": "github",
                "organization_name": organization.name,
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 401

    @pytest.mark.authenticated
    async def test_not_existing_organization(self, client: AsyncClient) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": "github",
                "organization_name": "not_existing",
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_not_existing_repository(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "repository_name": "not_existing",
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 404

    @pytest.mark.authenticated
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        subscription_tiers: list[SubscriptionTier],
    ) -> None:
        response = await client.get(
            "/api/v1/subscriptions/subscriptions/statistics",
            params={
                "platform": organization.platform.value,
                "organization_name": organization.name,
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
            },
        )

        assert response.status_code == 200

        json = response.json()
        assert len(json["periods"]) == 12


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
class TestBenefitProperties:
    async def test_note_not_in_public_apis(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        auth_jwt: str,
    ) -> None:
        response = await client.post(
            "/api/v1/subscriptions/benefits/",
            json={
                "type": "custom",
                "description": "Subscription Benefit",
                "is_tax_applicable": True,
                "properties": {"note": "SECRET"},
                "organization_id": str(organization.id),
            },
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )
        assert response.status_code == 201
        json = response.json()
        assert "properties" in json

        # add benefit to tier
        add_benefit = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/benefits",
            json={"benefits": [response.json()["id"]]},
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )
        assert add_benefit.status_code == 200

        # Assert does not show up in unauthorized benefits search
        benefits_search = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "organization_id": str(organization.id),
            },
        )
        assert benefits_search.status_code == 401

        # Assert does not show up in unauthorized tiers search
        tiers_search = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform,
                "organization_name": organization.name,
            },
        )
        assert tiers_search.status_code == 200

        json = tiers_search.json()

        assert 1 == len(json["items"])
        assert "properties" not in json["items"][0]
        assert "SECRET" not in tiers_search.text  # to be sure

    async def test_articles_paid_in_public_apis(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_admin: UserOrganization,
        subscription_tier_organization: SubscriptionTier,
        auth_jwt: str,
        session: AsyncSession,
    ) -> None:
        # create benefits
        (
            free_benefit,
            paid_benefit,
        ) = await subscription_benefit_service.get_or_create_articles_benefits(
            session, organization
        )
        await session.flush()

        # then
        session.expunge_all()

        # add benefit to tier
        add_benefit = await client.post(
            f"/api/v1/subscriptions/tiers/{subscription_tier_organization.id}/benefits",
            json={"benefits": [str(paid_benefit.id)]},
            cookies={settings.AUTH_COOKIE_KEY: auth_jwt},
        )
        assert add_benefit.status_code == 200

        # Assert does not show up in unauthorized benefits search
        benefits_search = await client.get(
            "/api/v1/subscriptions/benefits/search",
            params={
                "organization_id": str(organization.id),
            },
        )
        assert benefits_search.status_code == 401

        # Assert does not show up in unauthorized tiers search
        tiers_search = await client.get(
            "/api/v1/subscriptions/tiers/search",
            params={
                "platform": organization.platform,
                "organization_name": organization.name,
            },
        )
        assert tiers_search.status_code == 200

        json = tiers_search.json()

        assert 1 == len(json["items"])
        assert "paid_articles" in tiers_search.text  # to be sure
        assert json["items"][0]["benefits"][0]["properties"]["paid_articles"] is True
