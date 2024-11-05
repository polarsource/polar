from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import Storefront
from .service import storefront as storefront_service

router = APIRouter(prefix="/storefronts", tags=["storefronts"])

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/{slug}",
    summary="Get Organization Storefront",
    response_model=Storefront,
    responses={404: OrganizationNotFound},
)
async def get(slug: str, session: AsyncSession = Depends(get_db_session)) -> Storefront:
    """Get an organization storefront by slug."""
    organization = await storefront_service.get(session, slug)
    if organization is None:
        raise ResourceNotFound()

    customers, total = await storefront_service.list_customers(
        session, organization, pagination=PaginationParams(1, 3)
    )

    return Storefront.model_validate(
        {
            "organization": organization,
            "products": organization.products,
            "customers": {
                "total": total,
                "customers": customers,
            },
        }
    )
