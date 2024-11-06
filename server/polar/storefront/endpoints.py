from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.models import Product
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

    # Retrieve the product that was created from the migrated donation feature
    donation_product: Product | None = None
    for product in organization.products:
        if product.user_metadata.get("donation_product", False):
            donation_product = product

    customers, total = await storefront_service.list_customers(
        session, organization, pagination=PaginationParams(1, 3)
    )

    return Storefront.model_validate(
        {
            "organization": organization,
            "products": organization.products,
            "donation_product": donation_product,
            "customers": {
                "total": total,
                "customers": customers,
            },
        }
    )
