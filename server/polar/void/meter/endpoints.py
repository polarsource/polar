from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Query
from pydantic import AwareDatetime

from polar.exceptions import ResourceNotFound
from polar.models import VoidMeter
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.tinybird import TinybirdClient

from .schemas import Balance, Check, Meter
from .service import meter as meter_service

router = APIRouter(prefix="/meters", tags=["meters"], include_in_schema=False)


@router.get("", response_model=list[Meter], operation_id="meters:list")
async def list_meters(
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[VoidMeter]:
    return await meter_service.list(session, auth.organization.id)


@router.get(
    "/{id}",
    response_model=Meter,
    operation_id="meters:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_meter(
    id: UUID,
    auth: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> VoidMeter:
    return await meter_service.get(session, auth.organization.id, id)


@router.get(
    "/{id}/balance",
    response_model=Balance,
    operation_id="meters:balance",
    responses={
        404: {"model": ResourceNotFound.schema()},
        400: {"model": InvalidReducer.schema()},
    },
)
async def balance(
    id: UUID,
    external_identity_id: str,
    auth: VoidRead,
    tinybird: TinybirdClient,
    at: AwareDatetime | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> Balance:
    return await meter_service.balance(
        session, tinybird, auth.organization.id, id, external_identity_id, at
    )


@router.get(
    "/{id}/check",
    response_model=Check,
    operation_id="meters:check",
    responses={
        404: {"model": ResourceNotFound.schema()},
        400: {"model": InvalidReducer.schema()},
    },
)
async def check(
    id: UUID,
    external_identity_id: str,
    size: Annotated[float, Query(gt=0, allow_inf_nan=False)],
    auth: VoidRead,
    tinybird: TinybirdClient,
    session: AsyncSession = Depends(get_db_session),
) -> Check:
    return await meter_service.check(
        session, tinybird, auth.organization.id, id, external_identity_id, size
    )
