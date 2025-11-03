from typing import Annotated

from fastapi import Depends, Path

from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..schemas.organization import CustomerOrganizationData
from ..service.organization import (
    customer_organization as customer_organization_service,
)

router = APIRouter(prefix="/organizations", tags=["organizations", APITag.public])

OrganizationSlug = Annotated[str, Path(description="The organization slug.")]
OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{slug}",
    summary="Get Organization",
    response_model=CustomerOrganizationData,
    responses={404: OrganizationNotFound},
)
async def get(
    slug: OrganizationSlug,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerOrganizationData:
    """Get a customer portal's organization by slug."""
    organization = await customer_organization_service.get_by_slug(session, slug)

    if organization is None:
        raise ResourceNotFound()

    return CustomerOrganizationData.model_validate(
        {"organization": organization, "products": organization.products}
    )
