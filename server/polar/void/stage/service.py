from uuid import UUID

from pydantic import ValidationError

from polar.exceptions import ResourceNotFound
from polar.models import VoidStage
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.deploy.exceptions import InvalidDeployment
from polar.void.deploy.schemas import Deploy, DeployCreate
from polar.void.deploy.service import deploy as deploy_service
from polar.void.organization.service import organization as organization_service

from .exceptions import StageConflict
from .repository import StageRepository
from .schemas import StageDeploy, StageSave


class StageService:
    async def get(self, session: AsyncReadSession, organization_id: UUID) -> VoidStage:
        stage = await StageRepository.from_session(session).get(organization_id)
        if stage is None:
            raise ResourceNotFound()
        return stage

    async def save(
        self, session: AsyncSession, organization_id: UUID, body: StageSave
    ) -> VoidStage:
        organization = await organization_service.lock(session, organization_id)
        repository = StageRepository.from_session(session)
        stage = await repository.get(organization_id, include_deleted=True)
        revision = (
            stage.revision if stage is not None and not stage.is_deleted else None
        )
        if body.expected_revision != revision:
            raise StageConflict()
        configuration = body.configuration.model_dump(mode="json")
        if stage is None:
            stage = VoidStage(
                organization=organization, revision=1, configuration=configuration
            )
            await repository.create(stage, flush=True)
        else:
            stage.revision += 1
            stage.configuration = configuration
            stage.deleted_at = None
            await session.flush()
        return stage

    async def delete(
        self, session: AsyncSession, organization_id: UUID, expected_revision: int
    ) -> None:
        await organization_service.lock(session, organization_id)
        stage = await self.get(session, organization_id)
        if stage.revision != expected_revision:
            raise StageConflict()
        stage.set_deleted_at()
        await session.flush()

    async def deploy(
        self, session: AsyncSession, organization_id: UUID, body: StageDeploy
    ) -> Deploy:
        await organization_service.lock(session, organization_id)
        stage = await self.get(session, organization_id)
        if stage.revision != body.expected_revision:
            raise StageConflict()
        try:
            configuration = DeployCreate.model_validate(
                {
                    **stage.configuration,
                    "checksum": f"stage:{stage.id}:{stage.revision}",
                    "dry_run": body.dry_run,
                    "activate": body.activate,
                }
            )
        except ValidationError as error:
            raise InvalidDeployment(str(error)) from error
        deployment = await deploy_service.deploy(
            session, organization_id, configuration
        )
        if not body.dry_run:
            stage.set_deleted_at()
            await session.flush()
        return deployment


stage = StageService()
