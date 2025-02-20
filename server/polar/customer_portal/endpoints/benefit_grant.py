from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import BenefitGrant
from polar.models.benefit import BenefitType
from polar.openapi import APITag
from polar.order.schemas import OrderID
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.routing import APIRouter
from polar.subscription.schemas import SubscriptionID

from .. import auth
from ..schemas.benefit_grant import (
    CustomerBenefitGrant,
    CustomerBenefitGrantAdapter,
    CustomerBenefitGrantUpdate,
)
from ..service.benefit_grant import CustomerBenefitGrantSortProperty
from ..service.benefit_grant import (
    customer_benefit_grant as customer_benefit_grant_service,
)

router = APIRouter(
    prefix="/benefit-grants",
    tags=["benefit-grants", APITag.documented],
)

BenefitGrantID = Annotated[UUID4, Path(description="The benefit grant ID.")]
BenefitGrantNotFound = {
    "description": "Benefit grant not found.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[CustomerBenefitGrantSortProperty]],
    Depends(SortingGetter(CustomerBenefitGrantSortProperty, ["-granted_at"])),
]


@router.get(
    "/",
    summary="List Benefit Grants",
    response_model=ListResource[CustomerBenefitGrant],
)
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    type: MultipleQueryFilter[BenefitType] | None = Query(
        None, title="BenefitType Filter", description="Filter by benefit type."
    ),
    benefit_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="BenefitID Filter", description="Filter by benefit ID."
    ),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    checkout_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="CheckoutID Filter", description="Filter by checkout ID."
    ),
    order_id: MultipleQueryFilter[OrderID] | None = Query(
        None, title="OrderID Filter", description="Filter by order ID."
    ),
    subscription_id: MultipleQueryFilter[SubscriptionID] | None = Query(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CustomerBenefitGrant]:
    """List benefits grants of the authenticated customer."""
    results, count = await customer_benefit_grant_service.list(
        session,
        auth_subject,
        type=type,
        benefit_id=benefit_id,
        organization_id=organization_id,
        checkout_id=checkout_id,
        order_id=order_id,
        subscription_id=subscription_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [CustomerBenefitGrantAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Benefit Grant",
    response_model=CustomerBenefitGrant,
    responses={404: BenefitGrantNotFound},
)
async def get(
    id: BenefitGrantID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrant:
    """Get a benefit grant by ID for the authenticated customer."""
    benefit_grant = await customer_benefit_grant_service.get_by_id(
        session, auth_subject, id
    )

    if benefit_grant is None:
        raise ResourceNotFound()

    return benefit_grant


@router.patch(
    "/{id}",
    summary="Update Benefit Grant",
    response_model=CustomerBenefitGrant,
    responses={
        200: {"description": "Benefit grant updated."},
        403: {
            "description": "The benefit grant is revoked and cannot be updated.",
            "model": NotPermitted.schema(),
        },
        404: BenefitGrantNotFound,
    },
)
async def update(
    id: BenefitGrantID,
    benefit_grant_update: CustomerBenefitGrantUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrant:
    """Update a benefit grant for the authenticated customer."""
    benefit_grant = await customer_benefit_grant_service.get_by_id(
        session, auth_subject, id
    )

    if benefit_grant is None:
        raise ResourceNotFound()

    return await customer_benefit_grant_service.update(
        session, benefit_grant, benefit_grant_update
    )
