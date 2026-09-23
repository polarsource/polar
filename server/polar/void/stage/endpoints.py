from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.models import VoidStage
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.deploy.exceptions import (
    DeploymentConflict,
    DeploymentNotActivatable,
    InvalidDeployment,
)
from polar.void.deploy.schemas import Deploy

from .exceptions import StageConflict
from .schemas import Stage, StageDeploy, StageRevision, StageSave
from .service import stage as stage_service

router = APIRouter(prefix="/stage", tags=["stage", APITag.private])


@router.get(
    "",
    response_model=Stage,
    operation_id="stage:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get(
    auth: VoidRead, session: AsyncReadSession = Depends(get_db_read_session)
) -> VoidStage:
    return await stage_service.get(session, auth.organization.id)


@router.put(
    "",
    response_model=Stage,
    operation_id="stage:save",
    description="Save the complete staged configuration without deploying it. "
    "Use expected_revision=None when no stage exists. Revisions increase across discards.",
    responses={409: {"model": StageConflict.schema()}},
)
async def save(
    body: StageSave,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidStage:
    return await stage_service.save(session, auth.organization.id, body)


@router.delete(
    "",
    status_code=204,
    operation_id="stage:delete",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": StageConflict.schema()},
    },
)
async def delete(
    auth: VoidWrite,
    expected_revision: Annotated[StageRevision, Query()],
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await stage_service.delete(session, auth.organization.id, expected_revision)


@router.post(
    "/deploy",
    response_model=Deploy,
    status_code=201,
    operation_id="stage:deploy",
    description="Plan or deploy the staged configuration, optionally activating it. "
    "Successful deployments clear the stage; dry runs and failures retain it.",
    responses={
        400: {"model": InvalidDeployment.schema()},
        403: {"model": DeploymentNotActivatable.schema()},
        404: {"model": ResourceNotFound.schema()},
        409: {"model": StageConflict.schema() | DeploymentConflict.schema()},
    },
)
async def deploy(
    body: StageDeploy,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    return await stage_service.deploy(session, auth.organization.id, body)
