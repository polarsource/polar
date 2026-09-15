from uuid import uuid4

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PREFIX = "/v1/void"


@pytest.mark.asyncio
class TestSubscriptionRoutes:
    async def test_one_time_purchase_revoke_and_rebuild(
        self,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        headers = {"Authorization": f"Bearer {TOKEN}"}
        identity = await void_client.post(
            f"{PREFIX}/identities", headers=headers, json={"external_id": "buyer"}
        )
        assert identity.status_code == 201
        product = await void_client.post(
            f"{PREFIX}/products",
            headers=headers,
            json={
                "slug": "license",
                "name": "License",
                "price": {"type": "one_time", "amount": "99", "currency": "usd"},
            },
        )
        assert product.status_code == 201, product.text
        created = await void_client.post(
            f"{PREFIX}/subscriptions",
            headers=headers,
            json={"product_id": product.json()["id"], "external_identity_id": "buyer"},
        )
        assert created.status_code == 201, created.text
        item = created.json()
        assert item["status"] == "active"
        assert item["current_period_start"] is item["current_period_end"] is None
        assert item["product"]["price"] == {
            "type": "one_time",
            "amount": "99.000000",
            "currency": "usd",
        }
        listing = await void_client.get(
            f"{PREFIX}/subscriptions", headers=headers, params={"active": "true"}
        )
        assert listing.status_code == 200
        assert [entry["id"] for entry in listing.json()] == [item["id"]]
        fetched = await void_client.get(
            f"{PREFIX}/subscriptions/{item['id']}", headers=headers
        )
        assert fetched.json() == item
        revoked = await void_client.post(
            f"{PREFIX}/subscriptions/{item['id']}/revoke", headers=headers
        )
        assert revoked.status_code == 200, revoked.text
        assert revoked.json()["status"] == "revoked"
        duplicate = await void_client.post(
            f"{PREFIX}/subscriptions/{item['id']}/revoke", headers=headers
        )
        assert duplicate.status_code == 409
        rebuilt = await void_client.post(
            f"{PREFIX}/subscriptions/rebuild",
            headers=headers,
            params={"dry_run": "true"},
        )
        assert rebuilt.status_code == 200, rebuilt.text
        assert rebuilt.json() == {
            "subscriptions": 1,
            "created": 0,
            "updated": 0,
            "unchanged": 1,
            "orphaned": [],
            "applied": False,
        }

    async def test_read_token_cannot_write_or_rebuild(
        self,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        headers = {"Authorization": f"Bearer {TOKEN}"}
        assert (
            await void_client.get(f"{PREFIX}/subscriptions", headers=headers)
        ).status_code == 200
        for path, body in [
            (
                "subscriptions",
                {"product_id": str(uuid4()), "external_identity_id": "buyer"},
            ),
            ("subscriptions/rebuild", {}),
            (f"subscriptions/{uuid4()}/cancel", {}),
            (f"subscriptions/{uuid4()}/revoke", {}),
        ]:
            response = await void_client.post(
                f"{PREFIX}/{path}", headers=headers, json=body
            )
            assert response.status_code == 403, response.text
