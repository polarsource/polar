from copy import deepcopy
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import (
    Organization,
    VoidDeployment,
    VoidEntitlement,
    VoidEvent,
    VoidMeter,
    VoidProduct,
    VoidReducer,
    VoidReducerDependency,
    VoidReducerJob,
)
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.models.void_deployment import VoidDeploymentStatus
from polar.postgres import AsyncSession
from polar.void.deploy.exceptions import DeploymentNotActivatable
from polar.void.deploy.schemas import DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.entitlement.schemas import EntitlementCreate
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.service import meter as meter_service
from polar.void.organization.service import organization as organization_service
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
        )
    ]


def entry(plan: Any, kind: str, key: str) -> Any:
    return next(e for e in plan.entries if e.kind == kind and e.key == key)


@pytest.mark.asyncio
class TestDeploy:
    async def test_plan_apply_repeat_and_changed_version(
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
        assert await counts(session, organization) == [0] * 5
        first = await deploy_service.deploy(session, organization.id, config)
        assert first.applied
        assert first.id is not None
        assert first.status == VoidDeploymentStatus.draft
        assert first.version_id == config.version_id
        assert {entry.kind for entry in first.entries} == {
            "reducer",
            "meter",
            "entitlement",
            "product",
        }
        assert await counts(session, organization) == [2, 1, 1, 1, 1]
        repeated = await deploy_service.deploy(
            session,
            organization.id,
            config.model_copy(update={"checksum": "another-source-checksum"}),
        )
        assert repeated.id == first.id
        assert repeated.version_id == first.version_id
        assert repeated.checksum == "source-checksum"
        assert await counts(session, organization) == [2, 1, 1, 1, 1]
        changed = deepcopy(CONFIG)
        changed["meters"][0]["unit_amount"] = "0.02"
        changed["entitlements"][0]["description"] = "Reports"
        second = await deploy_service.deploy(
            session, organization.id, DeployCreate.model_validate(changed)
        )
        assert second.version_id != first.version_id
        # Nothing is active yet, so the second version is compared to nothing.
        assert entry(second, "meter", "tokens").action == "create"
        assert entry(second, "entitlement", "analytics").action == "update"
        meters = await meter_service.list(session, organization.id)
        assert {meter.version_id for meter in meters} == {
            first.version_id,
            second.version_id,
        }
        products = await product_service.list(session, organization.id)
        assert {product.version_id for product in products} == {
            first.version_id,
            second.version_id,
        }
        assert (
            await deploy_service.for_version(session, organization.id, first.version_id)
            is not None
        )
        assert (
            await deploy_service.for_version(session, organization.id, "0" * 64) is None
        )
        assert await deploy_service.for_version(session, organization.id, None) is None

    async def test_activation_archives_previous_and_diffs_against_active(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        first = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"activate": True})
        )
        assert first.status == VoidDeploymentStatus.active
        assert first.id is not None
        assert (
            await organization_service.active_version(session, organization.id)
            == first.version_id
        )
        changed = deepcopy(CONFIG)
        changed["meters"][0]["unit_amount"] = "0.02"
        changed["products"].append(
            {
                "slug": "team",
                "name": "Team",
                "price": {"type": "one_time", "amount": "5", "currency": "usd"},
            }
        )
        second = await deploy_service.deploy(
            session, organization.id, DeployCreate.model_validate(changed)
        )
        assert second.status == VoidDeploymentStatus.draft
        assert second.id is not None
        assert entry(second, "meter", "tokens").action == "replace"
        assert entry(second, "product", "pro").action == "unchanged"
        assert entry(second, "product", "team").action == "create"
        assert entry(second, "reducer", "usage").action == "unchanged"
        assert (
            await organization_service.active_version(session, organization.id)
            == first.version_id
        )
        activated = await deploy_service.activate(session, organization.id, second.id)
        assert activated.status == VoidDeploymentStatus.active
        previous = await deploy_service.get(session, organization.id, first.id)
        assert previous.status == VoidDeploymentStatus.archived
        assert (
            await organization_service.active_version(session, organization.id)
            == second.version_id
        )
        # Rolling back is activating the earlier deployment again.
        await deploy_service.activate(session, organization.id, first.id)
        assert (
            await organization_service.active_version(session, organization.id)
            == first.version_id
        )
        current = await deploy_service.get(session, organization.id, second.id)
        assert current.status == VoidDeploymentStatus.archived
        removed = deepcopy(CONFIG)
        removed["products"] = []
        plan = await deploy_service.deploy(
            session,
            organization.id,
            DeployCreate.model_validate({**removed, "dry_run": True}),
        )
        assert entry(plan, "product", "pro").action == "orphan"
        assert plan.status is None

    async def test_activation_requires_reviewed_organization(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.capabilities = {**STATUS_CAPABILITIES[OrganizationStatus.CREATED]}
        await session.flush()
        config = DeployCreate.model_validate(CONFIG)
        with pytest.raises(DeploymentNotActivatable):
            await deploy_service.deploy(
                session, organization.id, config.model_copy(update={"activate": True})
            )
        assert await counts(session, organization) == [0] * 5
        draft = await deploy_service.deploy(session, organization.id, config)
        assert draft.id is not None
        with pytest.raises(DeploymentNotActivatable):
            await deploy_service.activate(session, organization.id, draft.id)
        assert (
            await organization_service.active_version(session, organization.id) is None
        )
        with pytest.raises(ResourceNotFound):
            await deploy_service.activate(session, organization.id, organization.id)

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
        assert await counts(session, organization) == [0] * 5

    async def test_orphans_are_reported_against_the_active_version(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        old = deepcopy(CONFIG)
        old["products"].append(
            {
                "slug": "old-product",
                "name": "Old",
                "price": {"type": "one_time", "amount": "1", "currency": "usd"},
            }
        )
        active = await deploy_service.deploy(
            session,
            organization.id,
            DeployCreate.model_validate({**old, "activate": True}),
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
        config = DeployCreate.model_validate(CONFIG)
        plan = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
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
        assert entry(result, "meter", "tokens").action == "unchanged"
        assert entry(result, "product", "pro").action == "unchanged"
        # The old version's rows are untouched; subscriptions may still pin them.
        products = await product_service.list(session, organization.id)
        assert {(p.slug, p.version_id) for p in products} == {
            ("pro", active.version_id),
            ("old-product", active.version_id),
            ("pro", result.version_id),
        }

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
        assert await counts(session, organization) == [0] * 5

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
        assert await counts(session, organization) == [0] * 5

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
        assert await counts(session, organization) == [2, 1, 1, 1, 1]

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

    async def test_dry_run_of_a_deployed_version_returns_the_deployment(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        config = DeployCreate.model_validate(CONFIG)
        deployed = await deploy_service.deploy(session, organization.id, config)
        plan = await deploy_service.deploy(
            session, organization.id, config.model_copy(update={"dry_run": True})
        )
        assert plan.id == deployed.id
        assert plan.applied
        assert plan.status == VoidDeploymentStatus.draft
