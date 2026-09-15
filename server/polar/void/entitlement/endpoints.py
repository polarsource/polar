from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.models import VoidEntitlement
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite

from .schemas import Entitlement, EntitlementCreate
from .service import EntitlementSlugTaken
from .service import entitlement as entitlement_service

router = APIRouter(
    prefix="/entitlements", tags=["entitlements"], include_in_schema=False
)


@router.get("", response_model=list[Entitlement], operation_id="entitlements:list")
async def list_entitlements(
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[VoidEntitlement]:
    return await entitlement_service.list(session, auth_subject.subject.id)


@router.post(
    "",
    response_model=Entitlement,
    status_code=201,
    operation_id="entitlements:create",
    responses={
        404: {"model": ResourceNotFound.schema()},
        409: {"model": EntitlementSlugTaken.schema()},
    },
)
async def create_entitlement(
    body: EntitlementCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidEntitlement:
    entitlement, _ = await entitlement_service.upsert(
        session, auth_subject.subject.id, body
    )
    return entitlement


@router.get(
    "/{id}",
    response_model=Entitlement,
    operation_id="entitlements:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_entitlement(
    id: UUID,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> VoidEntitlement:
    return await entitlement_service.get(session, auth_subject.subject.id, id)
