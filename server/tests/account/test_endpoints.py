from typing import Any

import pytest
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization


@pytest.mark.asyncio
@pytest.mark.auth
async def test_create_invalid_account_type(
    client: AsyncClient, organization: Organization
) -> None:
    response = await client.post(
        "/v1/accounts",
        json={
            "account_type": "unknown",
            "country": "US",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.auth
async def test_create_personal_stripe(
    user: User,
    mocker: MockerFixture,
    client: AsyncClient,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    stripe_mock = mocker.patch.object(stripe_lib.Account, "create_async")

    class FakeStripeAccount:
        id = "fake_stripe_id"
        email = "foo@example.com"
        country = "SE"
        default_currency = "USD"
        details_submitted = False
        charges_enabled = False
        payouts_enabled = False
        business_type = "company"

        def to_dict(self) -> dict[str, Any]:
            return {"lol": "wut"}

    stripe_mock.return_value = FakeStripeAccount()

    create_response = await client.post(
        "/v1/accounts",
        json={
            "account_type": "stripe",
            "country": "US",
            "organization_id": str(organization.id),
        },
    )

    assert create_response.status_code == 200
    assert create_response.json()["account_type"] == "stripe"
    assert create_response.json()["stripe_id"] == "fake_stripe_id"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_dashboard_link_not_existing_account(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/v1/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/dashboard_link"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update(account: Account, client: AsyncClient) -> None:
    response = await client.patch(
        f"/v1/accounts/{account.id}",
        json={
            "billing_name": "John Doe",
            "billing_address": {
                "line1": "123 Main St",
                "postal_code": "10001",
                "city": "New York",
                "state": "NY",
                "country": "US",
            },
            "billing_notes": "This is a test billing note.",
        },
    )

    assert response.status_code == 200

    json = response.json()
    assert json["billing_name"] == "John Doe"
    assert json["billing_address"]["city"] == "New York"
    assert json["billing_notes"] == "This is a test billing note."
