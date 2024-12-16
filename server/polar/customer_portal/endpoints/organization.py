from typing import Annotated

from fastapi import Depends, Path

from polar.exceptions import ResourceNotFound
from polar.models import Organization
from polar.openapi import APITag
from polar.organization.schemas import Organization as OrganizationSchema
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..service.organization import (
    customer_organization as customer_organization_service,
)

router = APIRouter(prefix="/organizations", tags=["organizations", APITag.documented])

OrganizationSlug = Annotated[str, Path(description="The organization slug.")]
OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{slug}",
    summary="Get Organization",
    response_model=OrganizationSchema,
    responses={404: OrganizationNotFound},
)
async def get(
    slug: OrganizationSlug,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Get a customer portal's organization by slug."""
    organization = await customer_organization_service.get_by_slug(session, slug)

    if organization is None:
        raise ResourceNotFound()

    return organization
