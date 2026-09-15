from typing import Annotated

import structlog
from fastapi import Depends, Header, Path, Query, Request
from pydantic import UUID4
from sqlalchemy.orm import joinedload
from sse_starlette.sse import EventSourceResponse

from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_resource_permission
from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.eventstream.endpoints import subscribe
from polar.eventstream.service import Receivers
from polar.exceptions import PaymentNotReady, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import (
    MultipleQueryFilter,
    SetSchemaReference,
)
from polar.models import Checkout
from polar.models.checkout import CheckoutStatus
from polar.openapi import APITag
from polar.organization.embed_hosts import (
    csp_frame_ancestors,
    match_origin,
    parse_origin,
)
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
from .repository import CheckoutRepository
from .schemas import Checkout as CheckoutSchema
from .schemas import (
    CheckoutConfirm,
    CheckoutCreate,
    CheckoutEmbedPolicy,
    CheckoutOpened,
    CheckoutPublic,
    CheckoutPublicConfirmed,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from .service import (
    AlreadyActiveSubscriptionError,
    DiscountRedemptionLimitReached,
    ExpiredCheckoutError,
    NotOpenCheckout,
    PaymentError,
    TrialAlreadyRedeemed,
)
from .service import checkout as checkout_service

log = structlog.get_logger()

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
        | PaymentNotReady.schema()
        | TrialAlreadyRedeemed.schema()
        | DiscountRedemptionLimitReached.schema(),
        SetSchemaReference("CheckoutForbiddenError"),
    ],
}


@inner_router.get(
    "/",
    summary="List Checkout Sessions",
    response_model=ListResource[CheckoutSchema],
    tags=[APITag.mcp, APITag.cli],
    openapi_extra={
        "x-tool-name": "checkouts_list",
        "x-tool-title": "List checkout sessions",
        "x-tool-description": "List checkout sessions.",
        "x-tool-annotations": ["read_only", "idempotent"],
    },
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
    external_customer_id: MultipleQueryFilter[ExternalCustomerID] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by customer external ID.",
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
        external_customer_id=external_customer_id,
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
    tags=[APITag.mcp, APITag.cli],
    response_model=CheckoutSchema,
    responses={404: CheckoutNotFound},
    openapi_extra={
        "x-tool-name": "checkouts_get",
        "x-tool-title": "Get checkout session",
        "x-tool-description": "Get a checkout session by ID.",
        "x-tool-annotations": ["read_only", "idempotent"],
    },
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
) -> Checkout:
    """Update a checkout session."""
    checkout = await checkout_service.get_by_id(
        session, auth_subject, id, for_update=True
    )

    if checkout is None:
        raise ResourceNotFound()

    await assert_resource_permission(
        session, auth_subject, checkout, OrganizationPermission.sales_manage
    )

    return await checkout_service.update(
        session, checkout, checkout_update, ip_geolocation_client
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
) -> Checkout:
    """Update a checkout session by client secret."""
    checkout = await checkout_service.get_by_client_secret(
        session, client_secret, for_update=True
    )

    return await checkout_service.update(
        session, checkout, checkout_update, ip_geolocation_client
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
) -> Checkout:
    """
    Confirm a checkout session by client secret.

    Orders and subscriptions will be processed.
    """
    checkout = await checkout_service.get_by_client_secret(
        session, client_secret, for_update=True
    )

    return await checkout_service.confirm(
        session, auth_subject, checkout, checkout_confirm
    )


@inner_router.post(
    "/client/{client_secret}/opened",
    response_model=CheckoutPublic,
    summary="Mark Checkout Session as Opened",
    responses={
        200: {"description": "Checkout session marked as opened."},
        404: CheckoutNotFound,
        410: CheckoutExpired,
    },
    tags=[APITag.private],
    include_in_schema=False,
)
async def client_opened(
    client_secret: CheckoutClientSecret,
    checkout_opened: CheckoutOpened,
    session: AsyncSession = Depends(get_db_session),
) -> Checkout:
    """
    Mark a checkout session as opened by client for analytics/experiment purposes.
    """
    checkout = await checkout_service.get_by_client_secret(session, client_secret)
    return await checkout_service.mark_opened(
        session, checkout, checkout_opened.distinct_id
    )


@inner_router.get(
    "/client/{client_secret}/embed-policy",
    response_model=CheckoutEmbedPolicy,
    summary="Get Checkout Session Embed Policy from Client",
    responses={404: CheckoutNotFound},
    tags=[APITag.private],
    include_in_schema=False,
)
async def client_embed_policy(
    client_secret: CheckoutClientSecret,
    referer: Annotated[str | None, Header()] = None,
    sec_fetch_dest: Annotated[str | None, Header()] = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CheckoutEmbedPolicy:
    """Get the hosts allowed to embed a checkout session, as CSP sources."""
    repository = CheckoutRepository.from_session(session)
    checkout = await repository.get_by_client_secret(
        client_secret, options=(joinedload(Checkout.organization),)
    )
    if checkout is None:
        raise ResourceNotFound()

    organization = checkout.organization
    hosts = organization.embed_hosts
    enforced = organization.is_frame_ancestors_enforced
    parsed = parse_origin(referer) if referer is not None else None
    frame_origin = str(parsed) if parsed is not None else None
    allowed = (
        match_origin(frame_origin, hosts) is not None
        if frame_origin is not None
        else None
    )
    log.info(
        "Embedded checkout framing policy resolved",
        organization_id=str(checkout.organization_id),
        frame_origin=frame_origin,
        fetch_dest=sec_fetch_dest,
        allowed=allowed,
        enforced=enforced,
        embed_hosts=hosts,
    )

    return CheckoutEmbedPolicy(
        frame_ancestors=csp_frame_ancestors(hosts) if enforced else ["*"]
    )


@inner_router.get("/client/{client_secret}/stream", include_in_schema=False)
async def client_stream(
    request: Request,
    client_secret: CheckoutClientSecret,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> EventSourceResponse:
    checkout = await checkout_service.get_by_client_secret(session, client_secret)
    # Release the DB session before entering the long-lived SSE stream.
    # The session is no longer needed after the checkout lookup.
    await session.commit()
    receivers = Receivers(checkout_client_secret=checkout.client_secret)
    return EventSourceResponse(subscribe(redis, receivers.get_channels(), request))


router = APIRouter(prefix="/checkouts")
router.include_router(inner_router, prefix="/custom", include_in_schema=False)
router.include_router(inner_router)
