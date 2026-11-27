from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import Dispute
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import Dispute as DisputeSchema
from .schemas import DisputeID, DisputeListParams, DisputeNotFound
from .service import DisputeNotOpenError
from .service import dispute as dispute_service

router = APIRouter(prefix="/disputes", tags=["disputes", APITag.public])


@router.get("/", summary="List Disputes", response_model=ListResource[DisputeSchema])
async def list(
    filters: Annotated[DisputeListParams, Query()],
    auth_subject: auth.DisputesRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[DisputeSchema]:
    """List disputes."""
    results, count = await dispute_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        order_id=filters.order_id,
        status=filters.status,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [DisputeSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Dispute",
    response_model=DisputeSchema,
    responses={404: DisputeNotFound},
)
async def get(
    id: DisputeID,
    auth_subject: auth.DisputesRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Dispute:
    """Get a dispute by ID."""
    dispute = await dispute_service.get(session, auth_subject, id)

    if dispute is None:
        raise ResourceNotFound()

    return dispute


@router.post(
    "/{id}/accept",
    summary="Accept Dispute",
    response_model=DisputeSchema,
    responses={
        404: DisputeNotFound,
        409: {"model": DisputeNotOpenError.schema()},
    },
)
async def accept(
    id: DisputeID,
    auth_subject: auth.DisputesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Dispute:
    """Accept a dispute, conceding the chargeback.

    Closes the dispute with the processor (settling it as `lost`) and records
    the merchant's decision on the dispute's support case.
    """
    dispute = await dispute_service.get(session, auth_subject, id)

    if dispute is None:
        raise ResourceNotFound()

    return await dispute_service.accept(session, dispute)
