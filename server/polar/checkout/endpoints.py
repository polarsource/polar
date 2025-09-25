from typing import Annotated

from fastapi import Depends, Path, Query, Request
from pydantic import UUID4
from sse_starlette.sse import EventSourceResponse

from polar.customer.schemas.customer import CustomerID
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import PaymentNotReady, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import (
    MultipleQueryFilter,
    SetSchemaReference,
)
from polar.locker import Locker, get_locker
from polar.models import Checkout
from polar.models.checkout import CheckoutStatus
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
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
    CheckoutPublicConfirmed,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from .service import (
    AlreadyActiveSubscriptionError,
    ExpiredCheckoutError,
    NotOpenCheckout,
    PaymentError,
)
from .service import checkout as checkout_service

inner_router = APIRouter(tags=["checkouts", APITag.public])


CheckoutID = Annotated[UUID4, Path(description="The checkout session ID.")]
CheckoutClientSecret = Annotated[
    str, Path(description="The checkout session client secret.")
]
CheckoutNotFound = {
    "description": "Checkout session not found.",
    "model": ResourceNotFound.schema(),
}
CheckoutExpired = {
    "description": "The checkout session is expired.",
    "model": ExpiredCheckoutError.schema(),
}
CheckoutPaymentError = {
    "description": "The payment failed.",
    "model": PaymentError.schema(),
}
CheckoutForbiddenError = {
    "description": "The checkout is expired, the customer already has an active subscription, or the organization is not ready to accept payments.",
    "model": Annotated[
        AlreadyActiveSubscriptionError.schema()
        | NotOpenCheckout.schema()
        | PaymentNotReady.schema(),
        SetSchemaReference("CheckoutForbiddenError"),
    ],
}


@inner_router.get(
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
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    status: MultipleQueryFilter[CheckoutStatus] | None = Query(
        None,
        title="Status Filter",
        description="Filter by checkout session status.",
    ),
    query: str | None = Query(None, description="Filter by customer email."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[CheckoutSchema]:
    """List checkout sessions."""
    results, count = await checkout_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        customer_id=customer_id,
        status=status,
        query=query,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CheckoutSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@inner_router.get(
    "/{id}",
    summary="Get Checkout Session",
    response_model=CheckoutSchema,
    responses={404: CheckoutNotFound},
)
async def get(
    id: CheckoutID,
    auth_subject: auth.CheckoutRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Checkout:
    """Get a checkout session by ID."""
    checkout = await checkout_service.get_by_id(session, auth_subject, id)

    if checkout is None:
        raise ResourceNotFound()

    return checkout


@inner_router.post(
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


@inner_router.patch(
    "/{id}",
    response_model=CheckoutSchema,
    summary="Update Checkout Session",
    responses={
        200: {"description": "Checkout session updated."},
        404: CheckoutNotFound,
        403: CheckoutForbiddenError,
    },
)
async def update(
    id: CheckoutID,
    checkout_update: CheckoutUpdate,
    auth_subject: auth.CheckoutWrite,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Checkout:
    """Update a checkout session."""
    checkout = await checkout_service.get_by_id(session, auth_subject, id)

    if checkout is None:
        raise ResourceNotFound()

    return await checkout_service.update(
        session, locker, checkout, checkout_update, ip_geolocation_client
    )


@inner_router.get(
    "/client/{client_secret}",
    summary="Get Checkout Session from Client",
    response_model=CheckoutPublic,
    responses={404: CheckoutNotFound, 410: CheckoutExpired},
)
async def client_get(
    client_secret: CheckoutClientSecret,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """Get a checkout session by client secret."""
    return await checkout_service.get_by_client_secret(session, client_secret)


@inner_router.post(
    "/client/",
    summary="Create Checkout Session from Client",
    response_model=CheckoutPublic,
    status_code=201,
    tags=[APITag.private],
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


@inner_router.patch(
    "/client/{client_secret}",
    response_model=CheckoutPublic,
    summary="Update Checkout Session from Client",
    responses={
        200: {"description": "Checkout session updated."},
        404: CheckoutNotFound,
        403: CheckoutForbiddenError,
        410: CheckoutExpired,
    },
)
async def client_update(
    client_secret: CheckoutClientSecret,
    checkout_update: CheckoutUpdatePublic,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Checkout:
    """Update a checkout session by client secret."""
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    return await checkout_service.update(
        session, locker, checkout, checkout_update, ip_geolocation_client
    )


@inner_router.post(
    "/client/{client_secret}/confirm",
    response_model=CheckoutPublicConfirmed,
    summary="Confirm Checkout Session from Client",
    responses={
        200: {"description": "Checkout session confirmed."},
        400: CheckoutPaymentError,
        404: CheckoutNotFound,
        403: CheckoutForbiddenError,
        410: CheckoutExpired,
    },
)
async def client_confirm(
    client_secret: CheckoutClientSecret,
    checkout_confirm: CheckoutConfirm,
    auth_subject: auth.CheckoutWeb,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> Checkout:
    """
    Confirm a checkout session by client secret.

    Orders and subscriptions will be processed.
    """
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    return await checkout_service.confirm(
        session, locker, auth_subject, checkout, checkout_confirm
    )


@inner_router.get("/client/{client_secret}/stream", include_in_schema=False)
async def client_stream(
    request: Request,
    client_secret: CheckoutClientSecret,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    checkout = await checkout_service.get_by_client_secret(session, client_secret)

    receivers = Receivers(checkout_client_secret=checkout.client_secret)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


router = APIRouter(prefix="/checkouts")
router.include_router(inner_router, prefix="/custom", include_in_schema=False)
router.include_router(inner_router)
