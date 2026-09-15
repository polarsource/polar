from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.models import VoidMeter
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite
from polar.void.reducer.exceptions import InvalidReducer

from .schemas import Meter, MeterCreate
from .service import meter as meter_service

router = APIRouter(prefix="/meters", tags=["meters"], include_in_schema=False)


@router.get("", response_model=list[Meter], operation_id="meters:list")
async def list_meters(
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[VoidMeter]:
    return await meter_service.list(session, auth_subject.subject.id)


@router.post(
    "",
    response_model=Meter,
    status_code=201,
    operation_id="meters:create",
    responses={
        404: {"model": ResourceNotFound.schema()},
        400: {"model": InvalidReducer.schema()},
    },
)
async def create_meter(
    body: MeterCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidMeter:
    return await meter_service.create(session, auth_subject.subject.id, body)


@router.get(
    "/{id}",
    response_model=Meter,
    operation_id="meters:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_meter(
    id: UUID,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> VoidMeter:
    return await meter_service.get(session, auth_subject.subject.id, id)
