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
from polar.organization.schemas import OrganizationID
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.benefit_grant import BenefitGrant as BenefitGrantSchema
from ..schemas.benefit_grant import BenefitGrantAdapter, BenefitGrantUpdate
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
    "/", summary="List Benefit Grants", response_model=ListResource[BenefitGrantSchema]
)
async def list(
    auth_subject: auth.CustomerPortalRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    type: MultipleQueryFilter[BenefitType] | None = Query(
        None, title="BenefitType Filter", description="Filter by benefit type."
    ),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    order_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="OrderID Filter", description="Filter by order ID."
    ),
    subscription_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="SubscriptionID Filter", description="Filter by subscription ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitGrantSchema]:
    """List benefits grants of the authenticated customer or user."""
    results, count = await customer_benefit_grant_service.list(
        session,
        auth_subject,
        type=type,
        organization_id=organization_id,
        order_id=order_id,
        subscription_id=subscription_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [BenefitGrantAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Benefit Grant",
    response_model=BenefitGrantSchema,
    responses={404: BenefitGrantNotFound},
)
async def get(
    id: BenefitGrantID,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrant:
    """Get a benefit grant by ID for the authenticated customer or user."""
    benefit_grant = await customer_benefit_grant_service.get_by_id(
        session, auth_subject, id
    )

    if benefit_grant is None:
        raise ResourceNotFound()

    return benefit_grant


@router.get(
    "/{id}",
    summary="Update Benefit Grant",
    response_model=BenefitGrantSchema,
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
    benefit_grant_update: BenefitGrantUpdate,
    auth_subject: auth.CustomerPortalWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrant:
    """Update a benefit grant for the authenticated customer or user."""
    benefit_grant = await customer_benefit_grant_service.get_by_id(
        session, auth_subject, id
    )

    if benefit_grant is None:
        raise ResourceNotFound()

    return await customer_benefit_grant_service.update(
        session, benefit_grant, benefit_grant_update
    )
