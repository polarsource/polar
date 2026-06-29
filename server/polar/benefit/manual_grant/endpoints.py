from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.benefit.schemas import BenefitID
from polar.customer.schemas.customer import CustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import ManualGrant as ManualGrantModel
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from ..auth import BenefitsRead, BenefitsWrite
from .schemas import (
    ManualGrant,
    ManualGrantCreate,
    ManualGrantID,
)
from .service import manual_grant as manual_grant_service

router = APIRouter(
    prefix="/manual-grants",
    tags=["manual-grants", APITag.public],
)

ManualGrantNotFound = {
    "description": "Manual grant not found.",
    "model": ResourceNotFound.schema(),
}

GrantID = Annotated[UUID4, Path(description="The benefit grant ID.")]


@router.get(
    "/",
    response_model=ListResource[ManualGrant],
    summary="List Manual Grants",
)
async def list(
    auth_subject: BenefitsRead,
    pagination: PaginationParamsQuery,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    customer_id: MultipleQueryFilter[CustomerID] | None = Query(
        None, title="CustomerID Filter", description="Filter by customer ID."
    ),
    benefit_id: MultipleQueryFilter[BenefitID] | None = Query(
        None, title="BenefitID Filter", description="Filter by granted benefit ID."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[ManualGrant]:
    """List manual grants."""
    results, count = await manual_grant_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        customer_id=customer_id,
        benefit_id=benefit_id,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(
        [ManualGrant.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    response_model=ManualGrant,
    summary="Get Manual Grant",
    responses={404: ManualGrantNotFound},
)
async def get(
    id: ManualGrantID,
    auth_subject: BenefitsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ManualGrantModel:
    """Get a manual grant by ID."""
    manual_grant = await manual_grant_service.get(session, auth_subject, id)
    if manual_grant is None:
        raise ResourceNotFound("Manual grant not found")
    return manual_grant


@router.post(
    "/",
    response_model=ManualGrant,
    status_code=201,
    summary="Create Manual Grant",
    responses={201: {"description": "Manual grant created."}},
)
async def create(
    manual_grant_create: ManualGrantCreate,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualGrantModel:
    """Manually grant one or more benefits to a customer, independent of any
    purchase.

    Grants are materialized asynchronously, so the `grants` field is empty in this
    response. Fetch the manual grant again to observe the materialized grants.
    """
    return await manual_grant_service.create(
        session,
        auth_subject,
        customer_id=manual_grant_create.customer_id,
        grants=manual_grant_create.grants,
        expires_at=manual_grant_create.expires_at,
    )


@router.post(
    "/{id}/grants/{grant_id}/revoke",
    response_model=ManualGrant,
    summary="Revoke Manual Grant",
    responses={404: ManualGrantNotFound},
)
async def revoke_grant(
    id: ManualGrantID,
    grant_id: GrantID,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualGrantModel:
    """Revoke a single benefit grant within a manual grant."""
    manual_grant = await manual_grant_service.get(session, auth_subject, id)
    if manual_grant is None:
        raise ResourceNotFound("Manual grant not found")
    grant = next((g for g in manual_grant.grants if g.id == grant_id), None)
    if grant is None:
        raise ResourceNotFound("Benefit grant not found")
    return await manual_grant_service.revoke_grant(manual_grant, grant)
