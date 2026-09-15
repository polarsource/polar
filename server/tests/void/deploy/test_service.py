from copy import deepcopy
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import (
    Organization,
    VoidDeployment,
    VoidEntitlement,
    VoidEvent,
    VoidMeter,
    VoidOrganizationSettings,
    VoidProduct,
    VoidReducer,
    VoidReducerDependency,
    VoidReducerJob,
)
from polar.postgres import AsyncSession
from polar.void.deploy.schemas import DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.entitlement.schemas import EntitlementCreate
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.product.schemas import OneTimePrice, ProductCreate
from polar.void.product.service import product as product_service
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service
from tests.fixtures.database import SaveFixture

CONFIG: dict[str, Any] = {
    "checksum": "source-checksum",
    "reducers": [
        {
            "slug": "usage",
            "filter": {"conjunction": "and", "clauses": []},
            "aggregation": {"func": "count"},
        }
    ],
    "meters": [{"slug": "tokens", "reducer": "usage", "unit_amount": "0.01"}],
    "entitlements": [{"slug": "analytics", "name": "Analytics"}],
    "products": [
        {
            "slug": "pro",
            "name": "Pro",
            "price": {
                "type": "recurring",
                "interval": "month",
                "amount": "20",
                "currency": "usd",
            },
            "meters": [{"slug": "tokens", "included": 100}],
            "entitlements": ["analytics"],
        }
    ],
}


async def counts(session: AsyncSession, organization: Organization) -> list[int]:
    return [
        int(
            await session.scalar(
                select(func.count())
                .select_from(model)
                .where(model.organization_id == organization.id)
            )
            or 0
        )
        for model in (
            VoidReducer,
            VoidMeter,
            VoidEntitlement,
            VoidProduct,
            VoidDeployment,
            VoidOrganizationSettings,
        )
    ]


@pytest.mark.asyncio
class TestDeploy:
    async def test_plan_apply_repeat_and_changed_variant(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        plan = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
        assert not plan.applied
        assert plan.id is None
        assert all(
            entry.action == "create" and entry.id is None for entry in plan.entries
        )
        assert await counts(session, organization) == [0] * 6
        first = await deploy_service.deploy(session, organization.id, config)
        assert first.applied
        assert first.id is not None
        assert first.variant_id == config.variant_id
        assert {entry.kind for entry in first.entries} == {
            "reducer",
            "meter",
            "entitlement",
            "product",
        }
        assert await counts(session, organization) == [2, 1, 1, 1, 1, 0]
        repeated = await deploy_service.deploy(
            session,
            organization.id,
            config.model_copy(update={"checksum": "another-source-checksum"}),
        )
        assert all(entry.action == "unchanged" for entry in repeated.entries)
        assert repeated.variant_id == first.variant_id
        assert repeated.checksum == "another-source-checksum"
        assert await counts(session, organization) == [2, 1, 1, 1, 2, 0]
        changed = deepcopy(CONFIG)
        changed["meters"][0]["unit_amount"] = "0.02"
        changed["entitlements"][0]["description"] = "Reports"
        second = await deploy_service.deploy(
            session, organization.id, DeployCreate.model_validate(changed)
        )
        assert second.variant_id != first.variant_id
        assert (
            next(
                entry for entry in second.entries if entry.kind == "entitlement"
            ).action
            == "update"
        )
        meters = await meter_service.list(session, organization.id)
        assert len(meters) == 2
        assert {meter.generation_id for meter in meters} == {1}
        assert (
            await deploy_service.latest(session, organization.id, first.variant_id)
            is not None
        )
        assert await deploy_service.latest(session, organization.id, "0" * 64) is None

    async def test_apply_rolls_back_all_resources_on_late_failure(
        self, session: AsyncSession, organization: Organization, mocker: MockerFixture
    ) -> None:
        create = mocker.patch(
            "polar.void.deploy.service.product_service.create",
            new_callable=AsyncMock,
            side_effect=RuntimeError("failed at product"),
        )
        with pytest.raises(RuntimeError, match="failed at product"):
            await deploy_service.deploy(
                session, organization.id, DeployCreate.model_validate(CONFIG)
            )
        create.assert_awaited_once()
        assert await counts(session, organization) == [0] * 6

    async def test_same_variant_replaces_drift_and_reports_orphans(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        await deploy_service.deploy(session, organization.id, config)
        current = (await meter_service.list(session, organization.id))[0]
        await meter_service.create(
            session,
            organization.id,
            MeterCreate(
                variant_id=config.variant_id,
                name="Changed price",
                slug="tokens",
                usage_reducer_id=current.usage_reducer_id,
                credit_reducer_id=current.credit_reducer_id,
                unit_amount=Decimal(9),
                currency="usd",
            ),
        )
        orphan = await product_service.create(
            session,
            organization.id,
            ProductCreate(
                variant_id=config.variant_id,
                slug="old-product",
                name="Old",
                price=OneTimePrice(type="one_time", amount=Decimal(1), currency="usd"),
            ),
        )
        await entitlement_service.upsert(
            session, organization.id, EntitlementCreate(slug="old-feature")
        )
        await reducer_service.create(
            session,
            organization.id,
            ReducerCreate.model_validate(
                {**CONFIG["reducers"][0], "slug": "old-counter"}
            ),
        )
        plan = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
        assert orphan.archived_at is None
        assert {
            (entry.kind, entry.key)
            for entry in plan.entries
            if entry.action == "orphan"
        } == {
            ("product", "old-product"),
            ("entitlement", "old-feature"),
            ("reducer", "old-counter"),
        }
        result = await deploy_service.deploy(session, organization.id, config)
        replacement = next(entry for entry in result.entries if entry.kind == "meter")
        assert replacement.action == "replace"
        assert replacement.reason == "generation 2 -> 3"
        assert orphan.archived_at is not None

    @pytest.mark.parametrize("dry_run", [True, False])
    @pytest.mark.parametrize(
        "invalid",
        [
            "currency",
            "one_time",
            "missing_meter",
            "missing_entitlement",
            "dict_usage",
            "duplicate_meter",
            "duplicate_product",
            "duplicate_entitlement",
            "auto_credit_collision",
            "derived_usage",
        ],
    )
    async def test_invalid_config_has_plan_apply_parity(
        self,
        session: AsyncSession,
        organization: Organization,
        dry_run: bool,
        invalid: str,
    ) -> None:
        body = deepcopy(CONFIG)
        body["dry_run"] = dry_run
        if invalid == "currency":
            body["products"][0]["price"]["currency"] = "eur"
        elif invalid == "one_time":
            body["products"][0]["price"] = {
                "type": "one_time",
                "amount": 1,
                "currency": "usd",
            }
        elif invalid == "missing_meter":
            body["products"][0]["meters"] = ["missing"]
        elif invalid == "missing_entitlement":
            body["products"][0]["entitlements"] = ["missing"]
        elif invalid == "dict_usage":
            body["reducers"][0]["aggregation"] = {"func": "last"}
        elif invalid.startswith("duplicate_"):
            key = invalid.removeprefix("duplicate_") + "s"
            body[key].append(deepcopy(body[key][0]))
        elif invalid == "auto_credit_collision":
            body["meters"].append(
                {"slug": "other", "reducer": "usage", "unit_amount": 0}
            )
        elif invalid == "derived_usage":
            body["reducers"].append(
                {
                    "slug": "derived",
                    "aggregation": {
                        "func": "derive",
                        "inputs": {"a": "usage"},
                        "expression": "$a",
                    },
                }
            )
            body["meters"][0]["reducer"] = "derived"
        with pytest.raises(PolarError):
            await deploy_service.deploy(
                session, organization.id, DeployCreate.model_validate(body)
            )
        assert await counts(session, organization) == [0] * 6

    async def test_preview_plans_without_writing(
        self, session: AsyncSession, organization: Organization, mocker: MockerFixture
    ) -> None:
        lock = mocker.patch(
            "polar.void.deploy.service.organization_service.lock",
            new_callable=AsyncMock,
        )
        config = DeployCreate.model_validate(
            {
                **CONFIG,
                "dry_run": True,
                "preview": {"start": "2026-01-01", "end": "2026-02-01"},
            }
        )
        plan = await deploy_service.deploy(session, organization.id, config)
        assert not plan.applied
        lock.assert_awaited_once()
        assert await counts(session, organization) == [0] * 6

    async def test_derived_order_and_event_backfill(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        start = datetime(2026, 1, 1, tzinfo=UTC)
        await save_fixture(
            VoidEvent(
                organization=organization,
                external_id="old",
                timestamp=start,
                payload={},
            )
        )
        body = deepcopy(CONFIG)
        body["reducers"].insert(
            0,
            {
                "slug": "twice",
                "aggregation": {
                    "func": "derive",
                    "inputs": {"usage": "usage"},
                    "expression": "$usage * 2",
                },
            },
        )
        config = DeployCreate.model_validate(body)
        await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
        assert (await session.scalars(select(VoidReducerJob))).all() == []
        await deploy_service.deploy(session, organization.id, config)
        reducers = {
            row.slug: row
            for row in await reducer_service.list(session, organization.id)
        }
        assert (
            await session.get(VoidReducerJob, (reducers["usage"].id, start)) is not None
        )
        dependency = await session.get(
            VoidReducerDependency, (reducers["twice"].id, "usage")
        )
        assert dependency is not None
        assert dependency.source_reducer_id == reducers["usage"].id

    async def test_existing_credit_conflict_and_immutable_reducer(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        await deploy_service.deploy(session, organization.id, config)
        body = deepcopy(CONFIG)
        body["reducers"][0]["aggregation"] = {"func": "sum", "property": "amount"}
        with pytest.raises(PolarError) as error:
            await deploy_service.deploy(
                session, organization.id, DeployCreate.model_validate(body)
            )
        assert error.value.status_code == 409
        renamed = deepcopy(CONFIG)
        renamed["meters"][0]["slug"] = "different"
        renamed["products"][0]["meters"] = ["different"]
        with pytest.raises(PolarError, match="Automatic credit reducer"):
            await deploy_service.deploy(
                session, organization.id, DeployCreate.model_validate(renamed)
            )
        assert await counts(session, organization) == [2, 1, 1, 1, 1, 0]

    @pytest.mark.parametrize("kind", ["reducer", "automatic_credit", "entitlement"])
    @pytest.mark.parametrize("dry_run", [True, False])
    async def test_deleted_slugs_reserved_in_plan_and_apply(
        self,
        session: AsyncSession,
        organization: Organization,
        kind: str,
        dry_run: bool,
    ) -> None:
        if kind == "entitlement":
            entitlement, _ = await entitlement_service.upsert(
                session, organization.id, EntitlementCreate(slug="analytics")
            )
            entitlement.deleted_at = utc_now()
        else:
            definition = {
                **CONFIG["reducers"][0],
                "slug": "usage-credits" if kind == "automatic_credit" else "usage",
            }
            reducer = await reducer_service.create(
                session, organization.id, ReducerCreate.model_validate(definition)
            )
            reducer.deleted_at = utc_now()
        await session.flush()
        before = await counts(session, organization)
        config = DeployCreate.model_validate({**CONFIG, "dry_run": dry_run})
        with pytest.raises(PolarError, match="is reserved") as error:
            await deploy_service.deploy(session, organization.id, config)
        assert error.value.status_code == 409
        assert await counts(session, organization) == before

    async def test_replacement_generation_skips_deleted_versions(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        await deploy_service.deploy(session, organization.id, config)
        current = (await meter_service.list(session, organization.id))[0]
        for generation in (2, 3):
            meter = await meter_service.create(
                session,
                organization.id,
                MeterCreate(
                    variant_id=config.variant_id,
                    name="Price drift",
                    slug="tokens",
                    usage_reducer_id=current.usage_reducer_id,
                    credit_reducer_id=current.credit_reducer_id,
                    unit_amount=Decimal(9),
                    currency="usd",
                ),
            )
            product = await product_service.create(
                session,
                organization.id,
                ProductCreate(
                    variant_id=config.variant_id,
                    slug="pro",
                    name="Name drift",
                    price=OneTimePrice(
                        type="one_time", amount=Decimal(1), currency="usd"
                    ),
                ),
            )
            if generation == 3:
                meter.deleted_at = utc_now()
                product.deleted_at = utc_now()
        await session.flush()
        plan = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
        applied = await deploy_service.deploy(session, organization.id, config)
        for result in (plan, applied):
            replacements = [
                entry for entry in result.entries if entry.kind in {"meter", "product"}
            ]
            assert len(replacements) == 2
            assert all(entry.action == "replace" for entry in replacements)
            assert all(
                entry.reason is not None
                and entry.reason.startswith("generation 2 -> 4")
                for entry in replacements
            )
        assert (
            max(
                row.generation_id
                for row in await meter_service.list(session, organization.id)
            )
            == 4
        )
        assert (
            max(
                row.generation_id
                for row in await product_service.list(session, organization.id)
            )
            == 4
        )
