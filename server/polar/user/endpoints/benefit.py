from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Benefit
from polar.models.benefit import BenefitType
from polar.postgres import get_db_session

from .. import auth
from ..schemas.benefit import UserBenefit, UserBenefitAdapter
from ..service.benefit import SortProperty
from ..service.benefit import user_benefit as user_benefit_service

router = APIRouter(prefix="/benefits")

BenefitID = Annotated[UUID4, Path(description="The benefit ID.")]
BenefitNotFound = {
    "description": "Benefit not found or not granted.",
    "model": ResourceNotFound.schema(),
}

ListSorting = Annotated[
    list[Sorting[SortProperty]],
    Depends(SortingGetter(SortProperty, ["-granted_at"])),
]


@router.get("/", response_model=ListResource[UserBenefit])
async def list_benefits(
    auth_subject: auth.UserBenefitsRead,
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    type: BenefitType | None = Query(None, description="Filter by benefit type."),
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    order_id: UUID4 | None = Query(None, description="Filter by order ID."),
    subscription_id: UUID4 | None = Query(
        None, description="Filter by subscription ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[UserBenefit]:
    """List my granted benefits."""
    results, count = await user_benefit_service.list(
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
        [UserBenefitAdapter.validate_python(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    response_model=UserBenefit,
    responses={404: BenefitNotFound},
)
async def get_benefit(
    id: BenefitID,
    auth_subject: auth.UserBenefitsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Benefit:
    """Get a granted benefit by ID."""
    benefit = await user_benefit_service.get_by_id(session, auth_subject, id)

    if benefit is None:
        raise ResourceNotFound()

    return benefit
