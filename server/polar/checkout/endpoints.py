from typing import Annotated

from fastapi import Depends, Path, Query, Request
from pydantic import UUID4
from sse_starlette.sse import EventSourceResponse

from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import Checkout
from polar.openapi import IN_DEVELOPMENT_ONLY, APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from . import auth, ip_geolocation, sorting
from .schemas import Checkout as CheckoutSchema
from .schemas import (
    CheckoutConfirm,
    CheckoutCreate,
    CheckoutCreatePublic,
    CheckoutPublic,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from .service import checkout as checkout_service

router = APIRouter(
    prefix="/checkouts/custom",
    tags=["checkouts", "custom", APITag.documented, APITag.featured],
)


CheckoutID = Annotated[UUID4, Path(description="The checkout session ID.")]
CheckoutClientSecret = Annotated[
    str, Path(description="The checkout session client secret.")
]
CheckoutNotFound = {
    "description": "Checkout session not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/", summary="List Checkout Sessions", response_model=ListResource[CheckoutSchema]
)
async def list(
    auth_subject: auth.CheckoutRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CheckoutSchema]:
    """List checkout sessions."""
    results, count = await checkout_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CheckoutSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Checkout Session",
    response_model=CheckoutSchema,
    responses={404: CheckoutNotFound},
)
async def get(
    id: CheckoutID,
    auth_subject: auth.CheckoutRead,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Get a checkout session by ID."""
    checkout = await checkout_service.get_by_id(session, auth_subject, id)

    if checkout is None:
        raise ResourceNotFound()

    return checkout


@router.post(
    "/",
    response_model=CheckoutSchema,
    status_code=201,
    summary="Create Checkout Session",
    responses={201: {"description": "Checkout session created."}},
)
async def create(
    checkout_create: CheckoutCreate,
    auth_subject: auth.CheckoutWrite,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Create a checkout session."""
    return await checkout_service.create(
        session, checkout_create, auth_subject, ip_geolocation_client
    )


@router.patch(
    "/{id}",
    response_model=CheckoutSchema,
    summary="Update Checkout Session",
    responses={
        200: {"description": "Checkout session updated."},
        404: CheckoutNotFound,
    },
)
async def update(
    id: CheckoutID,
    checkout_update: CheckoutUpdate,
    auth_subject: auth.CheckoutWrite,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Update a checkout session."""
    checkout = await checkout_service.get_by_id(session, auth_subject, id)

    if checkout is None:
        raise ResourceNotFound()

    return await checkout_service.update(
        session, checkout, checkout_update, ip_geolocation_client
    )


@router.get(
    "/client/{client_secret}",
    summary="Get Checkout Session from Client",
    response_model=CheckoutPublic,
    responses={404: CheckoutNotFound},
)
async def client_get(
    client_secret: CheckoutClientSecret,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Get a checkout session by client secret."""
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    if checkout is None:
        raise ResourceNotFound()

    return checkout


@router.post(
    "/client/",
    summary="Create Checkout Session from Client",
    response_model=CheckoutPublic,
    status_code=201,
    include_in_schema=IN_DEVELOPMENT_ONLY,
    deprecated=True,
)
async def client_create(
    request: Request,
    checkout_create: CheckoutCreatePublic,
    auth_subject: auth.CheckoutWeb,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Create a checkout session from a client. Suitable to build checkout links."""
    ip_address = request.client.host if request.client else None
    return await checkout_service.client_create(
        session, checkout_create, auth_subject, ip_geolocation_client, ip_address
    )


@router.patch(
    "/client/{client_secret}",
    response_model=CheckoutPublic,
    summary="Update Checkout Session from Client",
    responses={
        200: {"description": "Checkout session updated."},
        404: CheckoutNotFound,
    },
)
async def client_update(
    client_secret: CheckoutClientSecret,
    checkout_update: CheckoutUpdatePublic,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Update a checkout session by client secret."""
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    if checkout is None:
        raise ResourceNotFound()

    return await checkout_service.update(
        session, checkout, checkout_update, ip_geolocation_client
    )


@router.post(
    "/client/{client_secret}/confirm",
    response_model=CheckoutPublic,
    summary="Confirm Checkout Session from Client",
    responses={
        200: {"description": "Checkout session confirmed."},
        404: CheckoutNotFound,
    },
)
async def client_confirm(
    client_secret: CheckoutClientSecret,
    checkout_confirm: CheckoutConfirm,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """
    Confirm a checkout session by client secret.

    Orders and subscriptions will be processed.
    """
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    if checkout is None:
        raise ResourceNotFound()

    return await checkout_service.confirm(session, checkout, checkout_confirm)


@router.get("/client/{client_secret}/stream", include_in_schema=False)
async def client_stream(
    request: Request,
    client_secret: CheckoutClientSecret,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    if checkout is None:
        raise ResourceNotFound()

    receivers = Receivers(checkout_client_secret=checkout.client_secret)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))
