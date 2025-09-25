from fastapi import Depends, Query

from polar.customer.schemas.customer import CustomerID
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..auth import BenefitsRead
from ..schemas import BenefitGrant
from .service import benefit_grant as benefit_grant_service
from .sorting import ListSorting

router = APIRouter(prefix="/benefit-grants", tags=["benefit-grants", APITag.public])


@router.get(
    "/",
    response_model=ListResource[BenefitGrant],
    summary="List Benefit Grants",
)
async def list(
    auth_subject: BenefitsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    is_granted: bool | None = Query(
        None,
        description=(
            "Filter by granted status. "
            "If `true`, only granted benefits will be returned. "
            "If `false`, only revoked benefits will be returned. "
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitGrant]:
    """List benefit grants across all benefits for the authenticated organization."""

    # Extract the first organization_id if provided, otherwise use the auth subject's organization
    if organization_id is not None and len(organization_id) > 0:
        org_id = organization_id[0]
    else:
        # Use the authenticated organization
        if hasattr(auth_subject.subject, "id"):
            org_id = auth_subject.subject.id
        else:
            # If auth subject doesn't have organization, we need to handle this case
            # For now, require organization_id to be provided
            from polar.exceptions import BadRequest

            raise BadRequest("organization_id parameter is required")

    results, count = await benefit_grant_service.list_by_organization(
        session,
        org_id,
        is_granted=is_granted,
        customer_id=customer_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [BenefitGrant.model_validate(result) for result in results],
        count,
        pagination,
    )
