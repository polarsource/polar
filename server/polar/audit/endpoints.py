from datetime import datetime

from fastapi import Depends, Query
from pydantic import TypeAdapter

from polar.kit.metadata import get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Account
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    get_db_read_session,
)
from polar.routing import APIRouter

from .auth import AuditRead
from .schemas import Audit as AuditSchema
from .service import audit as audit_service

_AuditAdapter: TypeAdapter[AuditSchema] = TypeAdapter(AuditSchema)

router = APIRouter(prefix="/audit", tags=["audit", APITag.public])


@router.get(
    "/",
    summary="List Audit Logs",
    response_model=ListResource[AuditSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: AuditRead,
    pagination: PaginationParamsQuery,
    start_ts: datetime | None = Query(
        None,
        description="Start date.",
    ),
    end_ts: datetime | None = Query(None, description="End date."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Account:
    results, count = await audit_service.list(
        session,
        auth_subject,
        start_ts=start_ts,
        end_ts=end_ts,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [
            _AuditAdapter.validate_python(result, from_attributes=True)
            for result in results
        ],
        count,
        pagination,
    )
