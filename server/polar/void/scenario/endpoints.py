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

from .exceptions import InvalidScenario, ScenarioBaseUnavailable
from .schemas import Scenario, ScenarioCreate, ScenarioPreview, ScenarioUpdate
from .service import scenario as scenario_service

router = APIRouter(prefix="/scenarios", tags=["scenarios"], include_in_schema=False)

SCENARIO_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"model": InvalidScenario.schema()},
    404: {"model": ResourceNotFound.schema()},
}


@router.get("", response_model=list[Scenario], operation_id="scenarios:list")
async def list_scenarios(
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[Scenario]:
    return await scenario_service.list(session, auth.organization.id)


@router.post(
    "",
    response_model=Scenario,
    status_code=201,
    description="Start a pricing scenario from a deployed version. A scenario is a "
    "sandbox: it stays pinned to that version, is not part of the lineage and "
    "never serves traffic.",
    operation_id="scenarios:create",
    responses={
        **SCENARIO_ERRORS,
        400: {"model": ScenarioBaseUnavailable.schema()},
    },
)
async def create(
    body: ScenarioCreate,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Scenario:
    return await scenario_service.create(session, auth.organization.id, body)


@router.get(
    "/{id}",
    response_model=Scenario,
    operation_id="scenarios:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get(
    id: UUID,
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Scenario:
    return await scenario_service.to_schema(
        session, await scenario_service.get(session, auth.organization.id, id)
    )


@router.patch(
    "/{id}",
    response_model=Scenario,
    operation_id="scenarios:update",
    responses=SCENARIO_ERRORS,
)
async def update(
    id: UUID,
    body: ScenarioUpdate,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Scenario:
    return await scenario_service.update(session, auth.organization.id, id, body)


@router.delete(
    "/{id}",
    status_code=204,
    operation_id="scenarios:delete",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def delete(
    id: UUID,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await scenario_service.delete(session, auth.organization.id, id)


@router.post(
    "/{id}/promote",
    response_model=Deploy,
    status_code=201,
    description="Deploy the scenario's resolved configuration as a draft deployment. "
    "Activation is a separate step on the deployment.",
    operation_id="scenarios:promote",
    responses={
        **SCENARIO_ERRORS,
        400: {"model": InvalidDeployment.schema()},
        409: {"model": DeploymentConflict.schema()},
    },
)
async def promote(
    id: UUID,
    auth: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    return await scenario_service.promote(session, auth.organization.id, id)


@router.post(
    "/{id}/preview",
    response_model=Deploy,
    description="Plan the scenario against current state and reprice the base "
    "version's usage over the window. Requires customers:read in addition to "
    "void:write. Writes nothing.",
    operation_id="scenarios:preview",
    responses=SCENARIO_ERRORS,
)
async def preview(
    id: UUID,
    body: ScenarioPreview,
    auth: VoidWrite,
    tinybird: TinybirdApi = Depends(get_client),
    session: AsyncSession = Depends(get_db_session),
) -> Deploy:
    await _CustomerRead(auth.auth_subject)
    scenario = await scenario_service.get(session, auth.organization.id, id)
    request = scenario_service.preview_request(scenario, body.window)
    plan = await deploy_service.deploy(session, auth.organization.id, request)
    await preview_prices(
        session, tinybird, auth, request, plan, scenario.base_version_id
    )
    return plan
