from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import Depends, Query

from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.metadata import MetadataQuery, get_metadata_query_openapi_schema
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.time_queries import is_under_limits
from polar.kit.versioning import version
from polar.models import Meter
from polar.openapi import APITag, cli_preview
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.version import V2027_01

from . import auth, sorting
from .schemas import Meter as MeterSchema
from .schemas import (
    MeterCreate,
    MeterID,
    MeterListParams,
    MeterQuantities,
    MeterQuantitiesParams,
    MeterUpdate,
)
from .service import AmbiguousExternalMeterID
from .service import meter as meter_service

router = APIRouter(
    prefix="/meters", tags=["meters", APITag.public, APITag.mcp, APITag.cli]
)


MeterNotFound = {
    "description": "Meter not found.",
    "model": ResourceNotFound.schema(),
}

AmbiguousExternalMeter = {
    "description": "The external ID matches meters in several "
    "accessible organizations.",
    "model": AmbiguousExternalMeterID.schema(),
}


@router.get(
    "/",
    summary="List Meters",
    response_model=ListResource[MeterSchema],
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def list(
    auth_subject: auth.MeterRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    metadata: MetadataQuery,
    filters: Annotated[MeterListParams, Query()],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[MeterSchema]:
    """List meters."""
    results, count = await meter_service.list(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        external_id=filters.external_id,
        metadata=metadata,
        query=filters.query,
        is_archived=filters.is_archived,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [MeterSchema.model_validate(result) for result in results], count, pagination
    )


@router.get(
    "/external/{external_id}",
    summary="Get Meter by External ID",
    openapi_extra=cli_preview(("id", "ID"), ("name", "Name"), ("unit", "Unit")),
    response_model=MeterSchema,
    responses={404: MeterNotFound, 409: AmbiguousExternalMeter},
)
@version(starting_from=V2027_01)
async def get_external(
    external_id: str,
    auth_subject: auth.MeterRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Meter:
    """Get a meter by external ID."""
    meter = await meter_service.get_external(session, auth_subject, external_id)

    if meter is None:
        raise ResourceNotFound()

    return meter


@router.get(
    "/{id}",
    summary="Get Meter",
    openapi_extra=cli_preview(("id", "ID"), ("name", "Name"), ("unit", "Unit")),
    response_model=MeterSchema,
    responses={404: MeterNotFound},
)
async def get(
    id: MeterID,
    auth_subject: auth.MeterRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Meter:
    """Get a meter by ID."""
    meter = await meter_service.get(session, auth_subject, id)

    if meter is None:
        raise ResourceNotFound()

    return meter


@router.get(
    "/{id}/quantities",
    summary="Get Meter Quantities",
    response_model=MeterQuantities,
    responses={404: MeterNotFound},
    openapi_extra={"parameters": [get_metadata_query_openapi_schema()]},
)
async def quantities(
    filters: Annotated[MeterQuantitiesParams, Query()],
    id: MeterID,
    auth_subject: auth.MeterRead,
    metadata: MetadataQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> MeterQuantities:
    """Get quantities of a meter over a time period."""
    meter = await meter_service.get(session, auth_subject, id)

    if meter is None:
        raise ResourceNotFound()

    if not is_under_limits(
        filters.start_timestamp, filters.end_timestamp, filters.interval
    ):
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("query",),
                    "msg": (
                        "The interval is too small for the given date range. "
                        "Use a larger interval or reduce the date range."
                    ),
                    "type": "value_error",
                    "input": (
                        filters.start_timestamp,
                        filters.end_timestamp,
                        filters.interval,
                    ),
                }
            ]
        )

    return await meter_service.get_quantities(
        session,
        meter,
        start_timestamp=filters.start_timestamp,
        end_timestamp=filters.end_timestamp,
        interval=filters.interval,
        timezone=ZoneInfo(filters.timezone),
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        metadata=metadata,
        customer_aggregation_function=filters.customer_aggregation_function,
    )


@router.post(
    "/",
    response_model=MeterSchema,
    status_code=201,
    summary="Create Meter",
    responses={201: {"description": "Meter created."}},
)
async def create(
    meter_create: MeterCreate,
    auth_subject: auth.MeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Meter:
    """Create a meter."""
    return await meter_service.create(session, meter_create, auth_subject)


@router.patch(
    "/{id}",
    response_model=MeterSchema,
    summary="Update Meter",
    responses={
        200: {"description": "Meter updated."},
        404: MeterNotFound,
    },
)
async def update(
    id: MeterID,
    meter_update: MeterUpdate,
    auth_subject: auth.MeterWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Meter:
    """Update a meter."""
    meter = await meter_service.get(session, auth_subject, id)

    if meter is None:
        raise ResourceNotFound()

    return await meter_service.update(session, meter, meter_update, auth_subject)
