from typing import Annotated

from fastapi import Depends, Query

from polar.benefit.schemas import BenefitGrantListParams
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..auth import BenefitGrantsRead
from ..schemas import BenefitGrant
from .service import benefit_grant as benefit_grant_service
from .sorting import ListSorting

router = APIRouter(
    prefix="/benefit-grants",
    tags=["benefit-grants", APITag.public, APITag.mcp, APITag.cli],
)


@router.get(
    "/", response_model=ListResource[BenefitGrant], summary="List Benefit Grants"
)
async def list(
    auth_subject: BenefitGrantsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    filters: Annotated[BenefitGrantListParams, Query()],
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BenefitGrant]:
    """List benefit grants across all benefits accessible to the authenticated subject."""
    results, count = await benefit_grant_service.list_by_organization(
        session,
        auth_subject,
        organization_id=filters.organization_id,
        is_granted=filters.is_granted,
        customer_id=filters.customer_id,
        external_customer_id=filters.external_customer_id,
        external_benefit_id=filters.external_benefit_id,
        member_id=filters.member_id,
        external_member_id=filters.external_member_id,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [BenefitGrant.model_validate(result) for result in results], count, pagination
    )
