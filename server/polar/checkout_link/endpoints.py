from typing import Annotated

from fastapi import Depends, Path, Query, Request
from fastapi.datastructures import URL
from fastapi.responses import RedirectResponse
from pydantic import UUID4

from polar.checkout import ip_geolocation
from polar.checkout.service import checkout as checkout_service
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import CheckoutLink
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import CheckoutLink as CheckoutLinkSchema
from .schemas import CheckoutLinkCreate, CheckoutLinkUpdate
from .service import checkout_link as checkout_link_service

router = APIRouter(prefix="/checkout-links", tags=["checkout-links", APITag.documented])


CheckoutLinkID = Annotated[UUID4, Path(description="The checkout link ID.")]
CheckoutLinkClientSecret = Annotated[
    str, Path(description="The checkout link client secret.")
]
CheckoutLinkNotFound = {
    "description": "Checkout link not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/", summary="List Checkout Links", response_model=ListResource[CheckoutLinkSchema]
)
async def list(
    auth_subject: auth.CheckoutLinkRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    product_id: MultipleQueryFilter[ProductID] | None = Query(
        None, title="ProductID Filter", description="Filter by product ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CheckoutLinkSchema]:
    """List checkout links."""
    results, count = await checkout_link_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        product_id=product_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CheckoutLinkSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Checkout Link",
    response_model=CheckoutLinkSchema,
    responses={404: CheckoutLinkNotFound},
)
async def get(
    id: CheckoutLinkID,
    auth_subject: auth.CheckoutLinkRead,
    session: AsyncSession = Depends(get_db_session),
) -> CheckoutLink:
    """Get a checkout link by ID."""
    checkout_link = await checkout_link_service.get_by_id(session, auth_subject, id)

    if checkout_link is None:
        raise ResourceNotFound()

    return checkout_link


@router.post(
    "/",
    response_model=CheckoutLinkSchema,
    status_code=201,
    summary="Create Checkout Link",
    responses={201: {"description": "Checkout link created."}},
)
async def create(
    checkout_link_create: CheckoutLinkCreate,
    auth_subject: auth.CheckoutLinkWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CheckoutLink:
    """Create a checkout link."""
    return await checkout_link_service.create(
        session, checkout_link_create, auth_subject
    )


@router.patch(
    "/{id}",
    response_model=CheckoutLinkSchema,
    summary="Update Checkout Link",
    responses={
        200: {"description": "Checkout link updated."},
        404: CheckoutLinkNotFound,
    },
)
async def update(
    id: CheckoutLinkID,
    checkout_link_update: CheckoutLinkUpdate,
    auth_subject: auth.CheckoutLinkWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CheckoutLink:
    """Update a checkout link."""
    checkout_link = await checkout_link_service.get_by_id(session, auth_subject, id)

    if checkout_link is None:
        raise ResourceNotFound()

    return await checkout_link_service.update(
        session, checkout_link, checkout_link_update
    )


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Checkout Link",
    responses={
        204: {"description": "Checkout link deleted."},
        404: CheckoutLinkNotFound,
    },
)
async def delete(
    id: CheckoutLinkID,
    auth_subject: auth.CheckoutLinkWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a checkout link."""
    checkout_link = await checkout_link_service.get_by_id(session, auth_subject, id)

    if checkout_link is None:
        raise ResourceNotFound()

    await checkout_link_service.delete(session, checkout_link)


@router.get("/{client_secret}/redirect", include_in_schema=False)
async def redirect(
    request: Request,
    client_secret: CheckoutLinkClientSecret,
    ip_geolocation_client: ip_geolocation.IPGeolocationClient,
    embed_origin: str | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """Use a checkout link to create a checkout session and redirect to it."""
    checkout_link = await checkout_link_service.get_by_client_secret(
        session, client_secret
    )

    if checkout_link is None:
        raise ResourceNotFound()

    ip_address = request.client.host if request.client else None
    checkout = await checkout_service.checkout_link_create(
        session, checkout_link, embed_origin, ip_geolocation_client, ip_address
    )

    # Add the query parameters from the request to the URL
    checkout_url = URL(checkout.url)
    query_params = {
        k: v for k, v in request.query_params.items() if k not in {"embed_origin"}
    }
    checkout_url = checkout_url.include_query_params(**query_params)

    return RedirectResponse(checkout_url)
