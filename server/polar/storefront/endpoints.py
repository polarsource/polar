from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import PaginationParams
from polar.models import Product
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import OrganizationSlugLookup, Storefront
from .service import storefront as storefront_service

router = APIRouter(prefix="/storefronts", tags=["storefronts", APITag.private])

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
                "customers": [
                    {
                        "name": customer.name[0]
                        if customer.name
                        else customer.email[0],
                    }
                    for customer in customers
                ],
            },
        }
    )


@router.get(
    "/lookup/product/{product_id}",
    responses={404: OrganizationNotFound},
)
async def get_organization_slug_by_product_id(
    product_id: str, session: AsyncSession = Depends(get_db_session)
) -> OrganizationSlugLookup:
    """Get organization slug by product ID for legacy redirect purposes."""
    organization_slug = await storefront_service.get_organization_slug_by_product_id(
        session, product_id
    )
    if organization_slug is None:
        raise ResourceNotFound()

    return OrganizationSlugLookup(organization_slug=organization_slug)


@router.get(
    "/lookup/subscription/{subscription_id}",
    responses={404: OrganizationNotFound},
)
async def get_organization_slug_by_subscription_id(
    subscription_id: str, session: AsyncSession = Depends(get_db_session)
) -> OrganizationSlugLookup:
    """Get organization slug by subscription ID for legacy redirect purposes."""
    organization_slug = (
        await storefront_service.get_organization_slug_by_subscription_id(
            session, subscription_id
        )
    )
    if organization_slug is None:
        raise ResourceNotFound()

    return OrganizationSlugLookup(organization_slug=organization_slug)
