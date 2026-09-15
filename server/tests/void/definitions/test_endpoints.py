from uuid import uuid4

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PREFIX = "/v1/void"


@pytest.mark.asyncio
class TestDefinitionRoutes:
    async def test_create_read_and_archive_nested_definitions(
        self,
        void_client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        headers = {"Authorization": f"Bearer {TOKEN}"}
        reducers = []
        for slug, aggregation in (
            ("usage", {"func": "count"}),
            ("credits", {"func": "sum", "property": "metadata.amount"}),
        ):
            response = await void_client.post(
                f"{PREFIX}/reducers",
                headers=headers,
                json={
                    "slug": slug,
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": aggregation,
                },
            )
            assert response.status_code == 201, response.text
            reducers.append(response.json()["id"])
        meter_response = await void_client.post(
            f"{PREFIX}/meters",
            headers=headers,
            json={
                "slug": "requests",
                "name": "Requests",
                "usage_reducer_id": reducers[0],
                "credit_reducer_id": reducers[1],
                "unit_amount": "0.012345678912",
            },
        )
        assert meter_response.status_code == 201, meter_response.text
        meter = meter_response.json()
        assert meter["unit_amount"] == "0.012345678912"
        assert meter["variant_id"] is meter["branch_id"] is None
        entitlement_response = await void_client.post(
            f"{PREFIX}/entitlements", headers=headers, json={"slug": "export"}
        )
        assert entitlement_response.status_code == 201, entitlement_response.text
        entitlement = entitlement_response.json()
        body = {
            "slug": "pro",
            "name": "Pro",
            "price": {
                "type": "recurring",
                "interval": "month",
                "amount": "10.123456",
                "currency": "usd",
            },
            "meter_ids": [meter["id"]],
            "entitlement_ids": [entitlement["id"]],
            "meter_terms": {"requests": {"included": 100}},
        }
        response = await void_client.post(
            f"{PREFIX}/products", headers=headers, json=body
        )
        assert response.status_code == 201, response.text
        product = response.json()
        assert product["meters"] == [meter]
        assert product["entitlements"] == [entitlement]
        assert product["price"]["interval_count"] == 1
        assert product["meter_terms"]["requests"] == {
            "included": 100,
            "limit": "hard",
            "rollover_cap": 0,
        }
        for resource, row in (
            ("meters", meter),
            ("entitlements", entitlement),
            ("products", product),
        ):
            response = await void_client.get(
                f"{PREFIX}/{resource}/{row['id']}", headers=headers
            )
            assert response.status_code == 200
            assert response.json() == row
            response = await void_client.get(f"{PREFIX}/{resource}", headers=headers)
            assert response.status_code == 200
            assert response.json() == [row]
        response = await void_client.post(
            f"{PREFIX}/products", headers=headers, json={**body, "name": "Pro 2"}
        )
        assert response.status_code == 201
        assert response.json()["generation_id"] == 2
        response = await void_client.get(f"{PREFIX}/products", headers=headers)
        assert [p["name"] for p in response.json()] == ["Pro 2"]
        response = await void_client.get(
            f"{PREFIX}/products", headers=headers, params={"include_archived": "true"}
        )
        assert len(response.json()) == 2
        assert response.json()[0]["archived_at"] is not None
        second_token = f"{TOKEN}_second"
        await create_token(save_fixture, organization_second, token=second_token)
        organization_second.feature_settings = {
            **organization_second.feature_settings,
            "void_enabled": True,
        }
        await save_fixture(organization_second)
        second_headers = {"Authorization": f"Bearer {second_token}"}
        for resource, row in (
            ("meters", meter),
            ("entitlements", entitlement),
            ("products", product),
        ):
            response = await void_client.get(
                f"{PREFIX}/{resource}/{row['id']}", headers=second_headers
            )
            assert response.status_code == 404
            response = await void_client.get(
                f"{PREFIX}/{resource}", headers=second_headers
            )
            assert response.json() == []

    @pytest.mark.parametrize(
        ("resource", "body"),
        [
            ("entitlements", {"slug": "export"}),
            (
                "meters",
                {
                    "slug": "requests",
                    "name": "Requests",
                    "usage_reducer_id": str(uuid4()),
                    "credit_reducer_id": str(uuid4()),
                    "unit_amount": "0",
                },
            ),
            (
                "products",
                {
                    "slug": "pro",
                    "name": "Pro",
                    "price": {"type": "one_time", "amount": "10", "currency": "usd"},
                },
            ),
        ],
    )
    async def test_read_scope_cannot_create(
        self,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
        resource: str,
        body: dict[str, object],
    ) -> None:
        await create_token(save_fixture, organization)
        response = await void_client.post(
            f"{PREFIX}/{resource}",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json=body,
        )
        assert response.status_code == 403
