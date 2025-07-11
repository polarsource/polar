import uuid

import pytest
from httpx import AsyncClient

from polar.models import Organization, Product, User
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_subscription


@pytest.mark.asyncio
async def test_get_organization_slug_by_product_id_not_found(
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/v1/storefronts/lookup/product/{uuid.uuid4()}",
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_organization_slug_by_product_id(
    client: AsyncClient,
    organization: Organization,
    product: Product,
) -> None:
    response = await client.get(
        f"/v1/storefronts/lookup/product/{product.id}",
    )

    assert response.status_code == 200

    json = response.json()
    assert json["organization_slug"] == organization.slug


@pytest.mark.asyncio
async def test_get_organization_slug_by_subscription_id_not_found(
    client: AsyncClient,
) -> None:
    response = await client.get(
        f"/v1/storefronts/lookup/subscription/{uuid.uuid4()}",
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_organization_slug_by_subscription_id(
    save_fixture: SaveFixture,
    client: AsyncClient,
    organization: Organization,
    product: Product,
    user: User,
) -> None:
    customer = await create_customer(
        save_fixture, organization=organization, email=user.email
    )
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer
    )

    response = await client.get(
        f"/v1/storefronts/lookup/subscription/{subscription.id}",
    )

    assert response.status_code == 200

    json = response.json()
    assert json["organization_slug"] == organization.slug
