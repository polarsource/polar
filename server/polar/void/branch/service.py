import uuid
from collections.abc import Sequence

from polar.exceptions import ResourceNotFound
from polar.models import VoidBranch
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

from .exceptions import BranchBaseUnavailable, InvalidBranch
from .repository import BranchRepository
from .schemas import Branch, BranchCreate, BranchPatch, BranchUpdate


def _checksum(branch: VoidBranch) -> str:
    return f"branch:{branch.id}"


def resolve(base: DeployCreate, patch: BranchPatch) -> DeployCreate:
    """The base configuration with the patch applied, validated like a push."""
    payload = base.model_dump()
    products = {product["slug"]: product for product in payload["products"]}
    for slug, product_patch in patch.products.items():
        product = products.get(slug)
        if product is None:
            raise InvalidBranch(f"Product {slug!r} is not in the base version")
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
                raise InvalidBranch(
                    f"Product {slug!r} does not bill meter {meter_slug!r} in the base version"
                )
            product["meters"][index] = DeployProductMeter(
                slug=meter_slug, **terms.model_dump()
            ).model_dump()
    meters = {meter["slug"]: meter for meter in payload["meters"]}
    for slug, meter_patch in patch.meters.items():
        meter = meters.get(slug)
        if meter is None:
            raise InvalidBranch(f"Meter {slug!r} is not in the base version")
        if meter_patch.unit_amount is not None:
            meter["unit_amount"] = meter_patch.unit_amount
    return DeployCreate.model_validate(payload)


class BranchService:
    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: BranchCreate,
    ) -> Branch:
        base = await DeployRepository.from_session(session).by_version(
            organization_id, create_schema.base_version_id
        )
        if base is None:
            raise ResourceNotFound("Unknown version")
        if base.configuration is None:
            raise BranchBaseUnavailable()
        branch = VoidBranch(
            name=create_schema.name,
            base_version_id=base.version_id,
            base_deployment=base,
            patch=create_schema.patch.model_dump(mode="json"),
            organization=await organization_service.lock(session, organization_id),
        )
        self.resolved(branch)
        session.add(branch)
        await session.flush()
        return await self._to_schema(session, branch)

    async def update(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        id: uuid.UUID,
        update_schema: BranchUpdate,
    ) -> Branch:
        branch = await self.get(session, organization_id, id)
        if update_schema.name is not None:
            branch.name = update_schema.name
        if update_schema.patch is not None:
            branch.patch = update_schema.patch.model_dump(mode="json")
        self.resolved(branch)
        await session.flush()
        return await self._to_schema(session, branch)

    async def delete(
        self, session: AsyncSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> None:
        branch = await self.get(session, organization_id, id)
        branch.set_deleted_at()
        await session.flush()

    async def promote(
        self, session: AsyncSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> Deploy:
        """Deploy the resolved configuration as a draft; the branch survives."""
        branch = await self.get(session, organization_id, id)
        config = self.resolved(branch).model_copy(
            update={"checksum": _checksum(branch)}
        )
        deployment = await deploy_service.deploy(session, organization_id, config)
        branch.promoted_deployment_id = deployment.id
        await session.flush()
        return deployment

    def preview_request(
        self, branch: VoidBranch, window: PricePreviewWindow
    ) -> DeployCreate:
        return self.resolved(branch).model_copy(
            update={"checksum": _checksum(branch), "dry_run": True, "preview": window}
        )

    def resolved(self, branch: VoidBranch) -> DeployCreate:
        return resolve(self.base(branch), BranchPatch.model_validate(branch.patch))

    def base(self, branch: VoidBranch) -> DeployCreate:
        configuration = branch.base_deployment.configuration
        if configuration is None:
            raise BranchBaseUnavailable()
        return DeployCreate.model_validate(
            {**configuration, "checksum": branch.base_deployment.checksum}
        )

    async def list(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Sequence[Branch]:
        branches = await BranchRepository.from_session(session).list(organization_id)
        return await self._to_schemas(session, organization_id, branches)

    async def get(
        self, session: AsyncReadSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> VoidBranch:
        branch = await BranchRepository.from_session(session).get(organization_id, id)
        if branch is None:
            raise ResourceNotFound()
        return branch

    async def to_schema(self, session: AsyncReadSession, branch: VoidBranch) -> Branch:
        return await self._to_schema(session, branch)

    async def _to_schema(self, session: AsyncReadSession, branch: VoidBranch) -> Branch:
        (schema,) = await self._to_schemas(session, branch.organization_id, [branch])
        return schema

    async def _to_schemas(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        branches: Sequence[VoidBranch],
    ) -> Sequence[Branch]:
        resolved = [(branch, self.resolved(branch)) for branch in branches]
        deployments = await BranchRepository.from_session(
            session
        ).deployments_by_version(
            organization_id, {config.version_id for _, config in resolved}
        )
        return [
            Branch(
                id=branch.id,
                name=branch.name,
                base_version_id=branch.base_version_id,
                base_deployment_id=branch.base_deployment_id,
                patch=BranchPatch.model_validate(branch.patch),
                version_id=config.version_id,
                deployment_id=deployments.get(config.version_id),
                promoted_deployment_id=branch.promoted_deployment_id,
                base_configuration=self.base(branch),
                configuration=config.model_copy(update={"checksum": _checksum(branch)}),
                created_at=branch.created_at,
                modified_at=branch.modified_at,
            )
            for branch, config in resolved
        ]


branch = BranchService()
