import builtins
from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, Query

from polar.benefit.grant.manual.schemas import ManualGrantBenefitCreate
from polar.benefit.grant.manual.service import (
    manual_grant as manual_grant_service,
)
from polar.customer.schemas.customer import CustomerID, ExternalCustomerID
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import BenefitGrant as BenefitGrantModel
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..auth import BenefitsRead, BenefitsWrite
from ..schemas import BenefitGrant
from .schemas import BenefitGrantBatchCreate, BenefitGrantCreate
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


@router.post(
    "/",
    response_model=BenefitGrant,
    status_code=201,
    summary="Create Benefit Grant",
    responses={
        201: {"description": "Benefit grant queued."},
        404: {
            "description": "Customer not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def create(
    benefit_grant_create: BenefitGrantCreate,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrantModel:
    """Queue a manual benefit grant and return its stable pending resource."""
    manual_grant = await manual_grant_service.create(
        session,
        auth_subject,
        customer_id=benefit_grant_create.customer_id,
        grants=[
            ManualGrantBenefitCreate(
                benefit_id=benefit_grant_create.benefit_id,
                member_id=benefit_grant_create.member_id,
            )
        ],
        expires_at=benefit_grant_create.expires_at,
        reason=benefit_grant_create.reason,
    )
    return manual_grant.grants[0]


@router.post(
    "/batch",
    response_model=builtins.list[BenefitGrant],
    status_code=201,
    summary="Create Benefit Grant Batch",
    responses={
        201: {"description": "Benefit grant batch queued."},
        404: {
            "description": "Customer not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def create_batch(
    benefit_grant_create: BenefitGrantBatchCreate,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[BenefitGrantModel]:
    """Queue manual benefit grants with shared provenance and expiration."""
    manual_grant = await manual_grant_service.create(
        session,
        auth_subject,
        customer_id=benefit_grant_create.customer_id,
        grants=[
            ManualGrantBenefitCreate(
                benefit_id=grant.benefit_id,
                member_id=grant.member_id,
            )
            for grant in benefit_grant_create.grants
        ],
        expires_at=benefit_grant_create.expires_at,
        reason=benefit_grant_create.reason,
    )
    return manual_grant.grants


@router.delete(
    "/{id}",
    response_model=BenefitGrant,
    status_code=202,
    summary="Revoke Benefit Grant",
    responses={
        202: {"description": "Benefit grant revocation queued."},
        404: {
            "description": "Benefit grant not found.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def revoke(
    id: UUID,
    auth_subject: BenefitsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrantModel:
    """Queue revocation of a manual benefit grant."""
    grant = await benefit_grant_service.get_manually_granted(session, auth_subject, id)
    if grant is None:
        raise ResourceNotFound("Benefit grant not found")

    manual_grant = grant.manual_grant
    assert manual_grant is not None
    await manual_grant_service.request_revoke(session, manual_grant, grant)
    return grant
