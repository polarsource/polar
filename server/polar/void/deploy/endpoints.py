from collections.abc import AsyncIterator, Sequence
from typing import Annotated
from uuid import UUID

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
from polar.void.organization.service import organization as organization_service
from polar.void.tinybird import TinybirdApi, get_client

from .exceptions import DeploymentConflict, DeploymentNotActivatable, InvalidDeployment
from .preview import preview_prices
from .schemas import Deploy, DeployCreate
from .service import deploy as deploy_service

router = APIRouter(prefix="/deploys", tags=["deploys"], include_in_schema=False)


async def preview_client(
    body: DeployCreate, auth: VoidWrite
) -> AsyncIterator[TinybirdApi | None]:
    if body.preview is None:
        yield None
    else:
        await _CustomerRead(auth.auth_subject)
        for client in get_client():
            yield client


@router.post(
    "",
    response_model=Deploy,
    description="Plan or apply configuration. A new version becomes a draft "
    "deployment; `activate` makes it the active one. Historical previews require "
    "dry_run and customers:read or customers:write in addition to void:write.",
    status_code=201,
    operation_id="deploys:create",
    responses={
        400: {"model": InvalidDeployment.schema()},
        403: {"model": DeploymentNotActivatable.schema()},
        409: {"model": DeploymentConflict.schema()},
    },
)
async def create(
    body: DeployCreate,
    auth: VoidWrite,
    tinybird: Annotated[TinybirdApi | None, Depends(preview_client)],
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    plan = await deploy_service.deploy(session, auth.organization_id, body)
    if body.preview is not None:
        assert tinybird is not None
        await preview_prices(
            session,
            tinybird,
            auth,
            body,
            plan,
            await organization_service.active_version(session, auth.organization_id),
        )
    return plan


@router.get("", response_model=list[Deploy], operation_id="deploys:list")
async def list_deploys(
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[Deploy]:
    return [
        deploy_service.to_schema(deployment)
        for deployment in await deploy_service.list(session, auth.organization_id)
    ]


@router.get(
    "/latest",
    response_model=Deploy,
    description="The deployment of one version, or the active deployment.",
    operation_id="deploys:latest",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def latest(
    auth: VoidRead,
    version_id: str | None = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Deploy:
    deployment = await deploy_service.for_version(
        session, auth.organization_id, version_id
    )
    if deployment is None:
        raise ResourceNotFound(
            "No active deployment" if version_id is None else "Unknown version"
        )
    return deploy_service.to_schema(deployment)


@router.get(
    "/{id}",
    response_model=Deploy,
    operation_id="deploys:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get(
    id: UUID,
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Deploy:
    return deploy_service.to_schema(
        await deploy_service.get(session, auth.organization_id, id)
    )


@router.post(
    "/{id}/activate",
    response_model=Deploy,
    description="Make a deployment the organization's production configuration. "
    "The previously active deployment is archived.",
    operation_id="deploys:activate",
    responses={
        403: {"model": DeploymentNotActivatable.schema()},
        404: {"model": ResourceNotFound.schema()},
    },
)
async def activate(
    id: UUID,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    return await deploy_service.activate(session, auth.organization_id, id)
