from typing import Annotated

from fastapi import Depends, Query
from pydantic import UUID4

from polar.benefit.schemas import BenefitGrantListParams
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.versioning import version
from polar.models import BenefitGrant as BenefitGrantModel
from polar.openapi import APITag, open_world
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.version import V2027_01

from ..auth import BenefitGrantsRead, BenefitGrantsWrite
from ..schemas import BenefitGrant
from .schemas import BenefitGrantCreate, BenefitGrantCreateExternal
from .service import BenefitGrantAlreadyExists
from .service import benefit_grant as benefit_grant_service
from .sorting import ListSorting

router = APIRouter(
    prefix="/benefit-grants",
    tags=["benefit-grants", APITag.public, APITag.mcp, APITag.cli],
)


@router.post(
    "/",
    response_model=BenefitGrant,
    status_code=201,
    summary="Create Benefit Grant",
    openapi_extra=open_world(),
    responses={409: {"model": BenefitGrantAlreadyExists.schema()}},
)
@version(starting_from=V2027_01)
async def create(
    auth_subject: BenefitGrantsWrite,
    benefit_grant_create: BenefitGrantCreate | BenefitGrantCreateExternal,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrantModel:
    """Manually grant a benefit to a customer or one of their members.

    Use either Polar IDs for every reference or external IDs for every reference.
    Fulfillment is asynchronous: the returned grant may not yet be granted.
    Meter-credit benefits cannot be granted manually.
    """
    return await benefit_grant_service.create(
        session, auth_subject, benefit_grant_create
    )


@router.delete(
    "/{id}",
    response_model=BenefitGrant,
    summary="Revoke Benefit Grant",
    openapi_extra=open_world(),
    responses={404: {"model": ResourceNotFound.schema()}},
)
@version(starting_from=V2027_01)
async def revoke(
    id: UUID4,
    auth_subject: BenefitGrantsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BenefitGrantModel:
    """Permanently revoke a benefit grant, including grants from purchases.

    Revocation is asynchronous. Once manually revoked, this grant cannot be
    reactivated by renewal or fulfillment retries. Other grants may still
    provide access to the benefit. Repeating this request is safe.
    """
    return await benefit_grant_service.revoke(session, auth_subject, id)


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
