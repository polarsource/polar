from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.organization.service import selected_variant

from .exceptions import DeploymentConflict, InvalidDeployment, PreviewUnavailable
from .schemas import Deploy, DeployCreate, DeployEntry
from .service import deploy as deploy_service

router = APIRouter(prefix="/deploys", tags=["deploys"], include_in_schema=False)


@router.post(
    "",
    response_model=Deploy,
    status_code=201,
    operation_id="deploys:create",
    responses={
        400: {"model": InvalidDeployment.schema()},
        409: {"model": DeploymentConflict.schema()},
        501: {"model": PreviewUnavailable.schema()},
    },
)
async def create(
    body: DeployCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    return await deploy_service.deploy(session, auth_subject.subject.id, body)


@router.get(
    "/latest",
    response_model=Deploy,
    operation_id="deploys:latest",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def latest(
    auth_subject: VoidRead,
    variant_id: str | None = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Deploy:
    deployment = await deploy_service.latest(
        session,
        auth_subject.subject.id,
        await selected_variant(session, auth_subject.subject.id, variant_id),
    )
    if deployment is None:
        raise ResourceNotFound("No deployment yet")
    return Deploy(
        variant_id=deployment.variant_id,
        id=deployment.id,
        checksum=deployment.checksum,
        applied=True,
        entries=[DeployEntry.model_validate(entry) for entry in deployment.entries],
        created_at=deployment.created_at,
    )
