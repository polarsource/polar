from datetime import timedelta
from unittest.mock import Mock
from uuid import uuid4

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import Organization, VoidEvent, VoidSubscription
from polar.postgres import AsyncSession
from polar.void.entitlement.schemas import EntitlementCreate
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.organization.service import organization as organization_service
from polar.void.product.schemas import ProductCreate
from polar.void.product.service import product as product_service
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

from .conftest import AT, START, Graph


@pytest.mark.asyncio
class TestCustomerState:
    async def test_replay_window_and_exact_receipts_exclude_other_trees(
        self,
        state_client: AsyncClient,
        graph: Graph,
        mocker: MockerFixture,
        tinybird: Mock,
    ) -> None:
        mocker.patch("polar.void.customer.state.utc_now", return_value=AT)
        response = await state_client.get(
            "/v1/void/customers/root/state", params={"since": START.isoformat()}
        )
        assert response.status_code == 200, response.text
        state = response.json()
        assert {node["external_id"] for node in state["identities"]} == {
            "root",
            "child",
            "sibling",
        }
        assert len(state["buckets"]) == 4
        assert all(
            bucket["bucket_start"] == START.isoformat().replace("+00:00", "Z")
            for bucket in state["buckets"]
        )
        assert all(
            len(bucket["last_processed_event"]["event_ids"]) == 2
            for bucket in state["buckets"]
        )
        meter = state["meters"][0]
        assert meter["usage_last_processed_event"]["external_id"] == "sibling-70"
        holders = {
            holder["external_identity_id"]: holder for holder in meter["holders"]
        }
        assert holders["root"]["balance"]["remaining"] == 22
        assert holders["child"]["balance"]["remaining"] == 12
        assert holders["sibling"]["is_holder"] is False
        assert holders["root"]["usage_base"] == 3
        assert all(
            not holder["balance"]["cycles"] and not holder["balance"]["boundaries"]
            for holder in holders.values()
        )
        assert tinybird.query.call_args.args[0] == "void_meter_subscriptions"
        response = await state_client.get("/v1/void/customers/root/state")
        assert response.status_code == 200, response.text
        compact = response.json()
        assert compact["buckets"] == []
        assert compact["since"] == compact["at"]
        assert all(
            holder["base"] == holder["balance"] and holder["events"] == []
            for holder in compact["meters"][0]["holders"]
        )

    async def test_uses_selected_version_and_latest_mainline_generation(
        self,
        state_client: AsyncClient,
        graph: Graph,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.void.customer.state.utc_now", return_value=AT)
        definition = MeterCreate.model_validate(graph.meter)
        chosen = await meter_service.create(
            session,
            organization.id,
            definition.model_copy(update={"version_id": "a" * 64}),
        )
        await meter_service.create(
            session,
            organization.id,
            definition.model_copy(
                update={"version_id": "a" * 64, "branch_id": uuid4()}
            ),
        )
        await meter_service.create(
            session,
            organization.id,
            definition.model_copy(update={"version_id": "b" * 64}),
        )
        await organization_service.set_default_version(
            session, organization.id, "a" * 64
        )
        response = await state_client.get("/v1/void/customers/root/state")
        assert response.status_code == 200, response.text
        assert [m["meter"]["id"] for m in response.json()["meters"]] == [str(chosen.id)]
        response = await state_client.get(
            "/v1/void/customers/root/state", params={"version_id": ""}
        )
        assert response.status_code == 200, response.text
        assert [m["meter"]["id"] for m in response.json()["meters"]] == [
            str(graph.meter.id)
        ]

    async def test_next_change_tracks_future_subscriptions_and_excludes_deleted(
        self,
        state_client: AsyncClient,
        graph: Graph,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.void.customer.state.utc_now", return_value=AT)
        product = await product_service.create(
            session,
            organization.id,
            ProductCreate.model_validate(
                {
                    "slug": "future",
                    "name": "Future",
                    "price": {"type": "one_time", "amount": "10", "currency": "usd"},
                }
            ),
        )
        for hours, deleted in ((1, True), (2, False)):
            await save_fixture(
                VoidSubscription(
                    organization=organization,
                    billing_identity=graph.root,
                    product=product,
                    status="active",
                    started_at=AT + timedelta(hours=hours),
                    deleted_at=utc_now() if deleted else None,
                )
            )
        response = await state_client.get("/v1/void/customers/root/state")
        assert response.status_code == 200, response.text
        assert response.json()["next_change_at"] == (
            AT + timedelta(hours=2)
        ).isoformat().replace("+00:00", "Z")


@pytest.mark.asyncio
class TestIdentitySnapshot:
    async def test_inherited_balances_entitlements_and_native_customer(
        self,
        state_client: AsyncClient,
        graph: Graph,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch("polar.void.identity.snapshot.utc_now", return_value=AT)
        entitlement, _ = await entitlement_service.upsert(
            session, organization.id, EntitlementCreate(slug="export")
        )
        product = await product_service.create(
            session,
            organization.id,
            ProductCreate.model_validate(
                {
                    "slug": "pro",
                    "name": "Pro",
                    "price": {"type": "one_time", "amount": "10", "currency": "usd"},
                    "entitlement_ids": [entitlement.id],
                }
            ),
        )
        await save_fixture(
            VoidSubscription(
                organization=organization,
                billing_identity=graph.root,
                product=product,
                status="active",
                started_at=START,
            )
        )
        response = await state_client.get("/v1/void/identities/child/snapshot")
        assert response.status_code == 200, response.text
        snapshot = response.json()
        assert snapshot["identity"]["external_id"] == "child"
        assert snapshot["root"]["external_id"] == "root"
        assert snapshot["customer"]["external_id"] == "root"
        assert snapshot["meters"]["tokens"]["remaining"] == 12
        assert snapshot["meters"]["tokens"]["limited_by"] == "child"
        assert snapshot["entitlements"] == ["export"]
        response = await state_client.get("/v1/void/identities/outsider/snapshot")
        assert response.status_code == 200, response.text
        assert response.json()["customer"] is None
        assert response.json()["entitlements"] == []

    @pytest.mark.parametrize(
        "path", ["customers/root/state", "identities/child/snapshot"]
    )
    async def test_native_customer_scope_is_required(
        self,
        path: str,
        void_client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
        snapshot_dependencies: None,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        response = await void_client.get(
            f"/v1/void/{path}", headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status_code == 403

    async def test_other_organization_cannot_access_state_or_snapshot(
        self,
        state_client: AsyncClient,
        graph: Graph,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        token = f"{TOKEN}_other"
        await create_token(
            save_fixture,
            organization_second,
            scopes={Scope.void_read, Scope.customers_read},
            token=token,
        )
        organization_second.feature_settings = {
            **organization_second.feature_settings,
            "void_enabled": True,
        }
        await save_fixture(organization_second)
        for path in ("customers/root/state", "identities/child/snapshot"):
            response = await state_client.get(
                f"/v1/void/{path}", headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 404


@pytest.mark.asyncio
class TestIdentityEntitlementRoutes:
    async def test_assignment_is_durable_and_retry_preserves_the_first_event(
        self,
        state_client: AsyncClient,
        graph: Graph,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        body = {
            "external_id": "assignment-1",
            "features": [],
            "meters": [{"meter": "tokens", "cap": 10}],
        }
        response = await state_client.put(
            "/v1/void/identities/child/entitlements", json=body
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "features": [],
            "meters": [{"meter": "tokens", "cap": 10}],
        }
        repeated = await state_client.put(
            "/v1/void/identities/child/entitlements",
            json={**body, "features": None, "meters": []},
        )
        assert repeated.status_code == 200, repeated.text
        assert repeated.json() == response.json()
        rows = (
            await session.scalars(
                select(VoidEvent).where(
                    VoidEvent.organization_id == organization.id,
                    VoidEvent.external_id == "assignment-1",
                )
            )
        ).all()
        assert len(rows) == 1
        assert rows[0].payload["name"] == "identity.entitlements.updated"
        response = await state_client.get("/v1/void/identities/child/entitlements")
        assert response.status_code == 200, response.text
        assert response.json()["external_identity_id"] == "child"
        assert response.json()["slugs"] == []
        assert response.json()["assignments"] == {
            "child": {"features": None, "meters": None},
            "root": {"features": None, "meters": None},
        }
