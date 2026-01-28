from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import PerkCategory
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import Perk as PerkSchema
from .schemas import PerkClaimResponse, PerkWithCode
from .service import perk as perk_service

router = APIRouter(prefix="/perks", tags=["perks", APITag.public])

PerkNotFound = {
    "description": "Perk not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Perks",
    response_model=ListResource[PerkSchema],
)
async def list_perks(
    auth_subject: auth.PerksRead,
    pagination: PaginationParamsQuery,
    category: PerkCategory | None = Query(
        None, title="Category Filter", description="Filter by perk category."
    ),
    featured: bool | None = Query(
        None, title="Featured Filter", description="Filter to only featured perks."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[PerkSchema]:
    """List all available perks in the Spaire Startup Stack."""
    results, count = await perk_service.list(
        session,
        category=category,
        featured_only=featured or False,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [PerkSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Perk",
    response_model=PerkSchema,
    responses={404: PerkNotFound},
)
async def get_perk(
    id: UUID4,
    auth_subject: auth.PerksRead,
    session: AsyncSession = Depends(get_db_session),
) -> PerkSchema:
    """Get a perk by ID."""
    perk = await perk_service.get_by_id(session, id)

    if perk is None:
        raise ResourceNotFound()

    return PerkSchema.model_validate(perk)


@router.post(
    "/{id}/claim",
    summary="Claim Perk",
    response_model=PerkClaimResponse,
    responses={404: PerkNotFound},
)
async def claim_perk(
    id: UUID4,
    auth_subject: auth.PerksWrite,
    session: AsyncSession = Depends(get_db_session),
) -> PerkClaimResponse:
    """
    Claim a perk to reveal redemption details.

    This endpoint tracks claim analytics and returns the full perk details
    including redemption URL or code.
    """
    claim, perk, total_claims = await perk_service.claim(
        session,
        perk_id=id,
        user_id=auth_subject.subject.id,
    )

    return PerkClaimResponse(
        claimed=True,
        perk=PerkWithCode.model_validate(perk),
        total_claims=total_claims,
    )
