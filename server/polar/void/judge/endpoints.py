from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.void.auth import VoidCustomerRead
from polar.void.identity.service import IdentityHierarchyConflict
from polar.void.organization.service import organization as organization_service

from .schemas import JudgeRequest, Judgment
from .service import judge as judge_service

router = APIRouter(prefix="/identities", tags=["identities"], include_in_schema=False)


@router.post(
    "/{external_id:path}/judge",
    response_model=Judgment,
    operation_id="identities:judge",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": IdentityHierarchyConflict.schema()},
    },
)
async def judge(
    external_id: str,
    body: JudgeRequest,
    auth: VoidCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> Judgment:
    """Ask Jev the SDK's question about this identity's recent meter events.

    Cached by the window's state, re-asked at most once a minute, and free when
    the window is empty. A missing Jev answer comes back as a null noul, not an
    error, so the SDK reports `unknown` and keeps its latch.
    """
    # Load the active deployment once for the default path and reuse it for
    # signal resolution; an explicit version stays lazy (loaded only if needed).
    deployment = (
        await organization_service.active_deployment(session, auth.organization.id)
        if body.version_id is None
        else None
    )
    version_id = body.version_id if deployment is None else deployment.version_id
    return await judge_service.judge(
        session,
        auth.organization.id,
        external_id,
        body,
        version_id,
        deployment,
    )
