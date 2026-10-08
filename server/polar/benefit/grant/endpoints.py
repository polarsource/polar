from fastapi import Depends, Query
from pydantic import UUID4

from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.versioning import version
from polar.member.schemas import ExternalMemberID
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.version import V2027_01

from ..auth import BenefitsRead
from ..schemas import BenefitGrant
from .service import benefit_grant as benefit_grant_service
from .sorting import ListSorting

router = APIRouter(
    prefix="/benefit-grants",
    tags=["benefit-grants", APITag.public, APITag.mcp, APITag.cli],
)


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
    external_customer_id: MultipleQueryFilter[ExternalCustomerID] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by customer external ID.",
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
    """List benefit grants across all benefits accessible to the authenticated subject."""
    results, count = await benefit_grant_service.list_by_organization(
        session,
        auth_subject,
        organization_id=organization_id,
        is_granted=is_granted,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [BenefitGrant.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/",
    name="list",
    response_model=ListResource[BenefitGrant],
    summary="List Benefit Grants",
)
@version(starting_from=V2027_01)
async def list_v2027_01(
    auth_subject: BenefitsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    external_customer_id: MultipleQueryFilter[ExternalCustomerID] | None = Query(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by customer external ID.",
    ),
    external_benefit_id: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalBenefitID Filter",
        description="Filter by benefit external ID.",
    ),
    member_id: MultipleQueryFilter[UUID4] | None = Query(
        None, title="MemberID Filter", description="Filter by member ID."
    ),
    external_member_id: MultipleQueryFilter[ExternalMemberID] | None = Query(
        None,
        title="ExternalMemberID Filter",
        description="Filter by member external ID.",
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
    """List benefit grants across all benefits accessible to the authenticated subject."""
    results, count = await benefit_grant_service.list_by_organization(
        session,
        auth_subject,
        organization_id=organization_id,
        is_granted=is_granted,
        customer_id=customer_id,
        external_customer_id=external_customer_id,
        external_benefit_id=external_benefit_id,
        member_id=member_id,
        external_member_id=external_member_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [BenefitGrant.model_validate(result) for result in results],
        count,
        pagination,
    )
