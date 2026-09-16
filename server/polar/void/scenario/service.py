import uuid
from collections.abc import Sequence

from polar.exceptions import ResourceNotFound
from polar.models import VoidScenario
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.deploy.repository import DeployRepository
from polar.void.deploy.schemas import (
    Deploy,
    DeployCreate,
    DeployProductMeter,
    PricePreviewWindow,
)
from polar.void.deploy.service import deploy as deploy_service
from polar.void.organization.service import organization as organization_service

from .exceptions import InvalidScenario, ScenarioBaseUnavailable
from .repository import ScenarioRepository
from .schemas import Scenario, ScenarioCreate, ScenarioPatch, ScenarioUpdate


def _checksum(scenario: VoidScenario) -> str:
    return f"scenario:{scenario.id}"


def resolve(base: DeployCreate, patch: ScenarioPatch) -> DeployCreate:
    """The base configuration with the patch applied, validated like a push."""
    payload = base.model_dump()
    products = {product["slug"]: product for product in payload["products"]}
    for slug, product_patch in patch.products.items():
        product = products.get(slug)
        if product is None:
            raise InvalidScenario(f"Product {slug!r} is not in the base version")
        for field in ("name", "description", "price"):
            value = getattr(product_patch, field)
            if value is not None:
                product[field] = value.model_dump() if field == "price" else value
        billed = {
            (entry if isinstance(entry, str) else entry["slug"]): index
            for index, entry in enumerate(product["meters"])
        }
        for meter_slug, terms in product_patch.meters.items():
            index = billed.get(meter_slug)
            if index is None:
                raise InvalidScenario(
                    f"Product {slug!r} does not bill meter {meter_slug!r} in the base version"
                )
            product["meters"][index] = DeployProductMeter(
                slug=meter_slug, **terms.model_dump()
            ).model_dump()
    meters = {meter["slug"]: meter for meter in payload["meters"]}
    for slug, meter_patch in patch.meters.items():
        meter = meters.get(slug)
        if meter is None:
            raise InvalidScenario(f"Meter {slug!r} is not in the base version")
        if meter_patch.unit_amount is not None:
            meter["unit_amount"] = meter_patch.unit_amount
    return DeployCreate.model_validate(payload)


class ScenarioService:
    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: ScenarioCreate,
    ) -> Scenario:
        base = await DeployRepository.from_session(session).by_version(
            organization_id, create_schema.base_version_id
        )
        if base is None:
            raise ResourceNotFound("Unknown version")
        if base.configuration is None:
            raise ScenarioBaseUnavailable()
        scenario = VoidScenario(
            name=create_schema.name,
            base_version_id=base.version_id,
            base_deployment=base,
            patch=create_schema.patch.model_dump(mode="json"),
            organization=await organization_service.lock(session, organization_id),
        )
        self.resolved(scenario)
        session.add(scenario)
        await session.flush()
        return await self._to_schema(session, scenario)

    async def update(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        id: uuid.UUID,
        update_schema: ScenarioUpdate,
    ) -> Scenario:
        scenario = await self.get(session, organization_id, id)
        if update_schema.name is not None:
            scenario.name = update_schema.name
        if update_schema.patch is not None:
            scenario.patch = update_schema.patch.model_dump(mode="json")
        self.resolved(scenario)
        await session.flush()
        return await self._to_schema(session, scenario)

    async def delete(
        self, session: AsyncSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> None:
        scenario = await self.get(session, organization_id, id)
        scenario.set_deleted_at()
        await session.flush()

    async def promote(
        self, session: AsyncSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> Deploy:
        """Deploy the resolved configuration as a draft; the scenario survives."""
        scenario = await self.get(session, organization_id, id)
        config = self.resolved(scenario).model_copy(
            update={"checksum": _checksum(scenario)}
        )
        deployment = await deploy_service.deploy(session, organization_id, config)
        scenario.promoted_deployment_id = deployment.id
        await session.flush()
        return deployment

    def preview_request(
        self, scenario: VoidScenario, window: PricePreviewWindow
    ) -> DeployCreate:
        return self.resolved(scenario).model_copy(
            update={"checksum": _checksum(scenario), "dry_run": True, "preview": window}
        )

    def resolved(self, scenario: VoidScenario) -> DeployCreate:
        return resolve(
            self.base(scenario), ScenarioPatch.model_validate(scenario.patch)
        )

    def base(self, scenario: VoidScenario) -> DeployCreate:
        configuration = scenario.base_deployment.configuration
        if configuration is None:
            raise ScenarioBaseUnavailable()
        return DeployCreate.model_validate(
            {**configuration, "checksum": scenario.base_deployment.checksum}
        )

    async def list(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Sequence[Scenario]:
        scenarios = await ScenarioRepository.from_session(session).list(organization_id)
        return await self._to_schemas(session, organization_id, scenarios)

    async def get(
        self, session: AsyncReadSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> VoidScenario:
        scenario = await ScenarioRepository.from_session(session).get(
            organization_id, id
        )
        if scenario is None:
            raise ResourceNotFound()
        return scenario

    async def to_schema(
        self, session: AsyncReadSession, scenario: VoidScenario
    ) -> Scenario:
        return await self._to_schema(session, scenario)

    async def _to_schema(
        self, session: AsyncReadSession, scenario: VoidScenario
    ) -> Scenario:
        (schema,) = await self._to_schemas(
            session, scenario.organization_id, [scenario]
        )
        return schema

    async def _to_schemas(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        scenarios: Sequence[VoidScenario],
    ) -> Sequence[Scenario]:
        resolved = [(scenario, self.resolved(scenario)) for scenario in scenarios]
        deployments = await ScenarioRepository.from_session(
            session
        ).deployments_by_version(
            organization_id, {config.version_id for _, config in resolved}
        )
        return [
            Scenario(
                id=scenario.id,
                name=scenario.name,
                base_version_id=scenario.base_version_id,
                base_deployment_id=scenario.base_deployment_id,
                patch=ScenarioPatch.model_validate(scenario.patch),
                version_id=config.version_id,
                deployment_id=deployments.get(config.version_id),
                promoted_deployment_id=scenario.promoted_deployment_id,
                base_configuration=self.base(scenario),
                configuration=config.model_copy(
                    update={"checksum": _checksum(scenario)}
                ),
                created_at=scenario.created_at,
                modified_at=scenario.modified_at,
            )
            for scenario, config in resolved
        ]


scenario = ScenarioService()
