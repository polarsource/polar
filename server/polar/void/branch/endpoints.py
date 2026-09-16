from collections.abc import Sequence
from typing import Any
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
from polar.void.deploy.exceptions import (
    DeploymentConflict,
    InvalidDeployment,
)
from polar.void.deploy.preview import preview_prices
from polar.void.deploy.schemas import Deploy
from polar.void.deploy.service import deploy as deploy_service
from polar.void.tinybird import TinybirdApi, get_client

from .exceptions import BranchBaseUnavailable, InvalidBranch
from .schemas import Branch, BranchCreate, BranchPreview, BranchUpdate
from .service import branch as branch_service

router = APIRouter(prefix="/branches", tags=["branches"], include_in_schema=False)

BRANCH_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"model": InvalidBranch.schema()},
    404: {"model": ResourceNotFound.schema()},
}


@router.get("", response_model=list[Branch], operation_id="branches:list")
async def list_branches(
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[Branch]:
    return await branch_service.list(session, auth.organization.id)


@router.post(
    "",
    response_model=Branch,
    status_code=201,
    description="Fork a deployed version into a mutable branch. The branch stays "
    "pinned to that version and never serves traffic.",
    operation_id="branches:create",
    responses={
        **BRANCH_ERRORS,
        400: {"model": BranchBaseUnavailable.schema()},
    },
)
async def create(
    body: BranchCreate,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Branch:
    return await branch_service.create(session, auth.organization.id, body)


@router.get(
    "/{id}",
    response_model=Branch,
    operation_id="branches:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get(
    id: UUID,
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Branch:
    return await branch_service.to_schema(
        session, await branch_service.get(session, auth.organization.id, id)
    )


@router.patch(
    "/{id}",
    response_model=Branch,
    operation_id="branches:update",
    responses=BRANCH_ERRORS,
)
async def update(
    id: UUID,
    body: BranchUpdate,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Branch:
    return await branch_service.update(session, auth.organization.id, id, body)


@router.delete(
    "/{id}",
    status_code=204,
    operation_id="branches:delete",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def delete(
    id: UUID,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await branch_service.delete(session, auth.organization.id, id)


@router.post(
    "/{id}/promote",
    response_model=Deploy,
    status_code=201,
    description="Deploy the branch's resolved configuration as a draft deployment. "
    "Activation is a separate step on the deployment.",
    operation_id="branches:promote",
    responses={
        **BRANCH_ERRORS,
        400: {"model": InvalidDeployment.schema()},
        409: {"model": DeploymentConflict.schema()},
    },
)
async def promote(
    id: UUID,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    return await branch_service.promote(session, auth.organization.id, id)


@router.post(
    "/{id}/preview",
    response_model=Deploy,
    description="Plan the branch against current state and reprice the base "
    "version's usage over the window. Requires customers:read in addition to "
    "void:write. Writes nothing.",
    operation_id="branches:preview",
    responses=BRANCH_ERRORS,
)
async def preview(
    id: UUID,
    body: BranchPreview,
    auth: VoidWrite,
    tinybird: TinybirdApi = Depends(get_client),
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    await _CustomerRead(auth.auth_subject)
    branch = await branch_service.get(session, auth.organization.id, id)
    request = branch_service.preview_request(branch, body.window)
    plan = await deploy_service.deploy(session, auth.organization.id, request)
    await preview_prices(session, tinybird, auth, request, plan, branch.base_version_id)
    return plan
