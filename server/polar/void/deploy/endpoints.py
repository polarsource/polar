from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends

from polar.customer.auth import _CustomerRead
from polar.exceptions import ResourceNotFound
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.organization.service import selected_version
from polar.void.tinybird import TinybirdApi, get_client

from .exceptions import DeploymentConflict, InvalidDeployment
from .preview import preview_prices
from .schemas import Deploy, DeployCreate, DeployEntry
from .service import deploy as deploy_service

router = APIRouter(prefix="/deploys", tags=["deploys"], include_in_schema=False)


async def preview_client(
    body: DeployCreate, auth_subject: VoidWrite
) -> AsyncIterator[TinybirdApi | None]:
    if body.preview is None:
        yield None
    else:
        await _CustomerRead(auth_subject)
        for client in get_client():
            yield client


@router.post(
    "",
    response_model=Deploy,
    description="Plan or apply configuration. Historical previews require dry_run "
    "and customers:read or customers:write in addition to void:write.",
    status_code=201,
    operation_id="deploys:create",
    responses={
        400: {"model": InvalidDeployment.schema()},
        409: {"model": DeploymentConflict.schema()},
    },
)
async def create(
    body: DeployCreate,
    auth_subject: VoidWrite,
    tinybird: Annotated[TinybirdApi | None, Depends(preview_client)],
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    plan = await deploy_service.deploy(session, auth_subject.subject.id, body)
    if body.preview is not None:
        assert tinybird is not None
        await preview_prices(
            session,
            tinybird,
            auth_subject,
            body,
            plan,
            await selected_version(session, auth_subject.subject.id, None),
        )
    return plan


@router.get(
    "/latest",
    response_model=Deploy,
    operation_id="deploys:latest",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def latest(
    auth_subject: VoidRead,
    version_id: str | None = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Deploy:
    deployment = await deploy_service.latest(
        session,
        auth_subject.subject.id,
        await selected_version(session, auth_subject.subject.id, version_id),
    )
    if deployment is None:
        raise ResourceNotFound("No deployment yet")
    return Deploy(
        version_id=deployment.version_id,
        id=deployment.id,
        checksum=deployment.checksum,
        applied=True,
        entries=[DeployEntry.model_validate(entry) for entry in deployment.entries],
        created_at=deployment.created_at,
    )
