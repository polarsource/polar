from fastapi import Depends, Request
from pydantic import UUID4

from polar.exceptions import ResourceNotFound, ResourceNotModified
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import ProductID
from polar.product.service.product import product as product_service
from polar.routing import APIRouter

from . import auth
from .schemas import ProductEmbed

router = APIRouter(
    prefix="/embed",
    tags=["embeds"],
)


@router.get("/product/{id}", summary="Product Embed")
async def get_product(
    request: Request,
    auth_subject: auth.EmbedsRead,
    id: ProductID,
    price_id: UUID4 | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> ProductEmbed:
    """Get product card."""
    product = await product_service.get_embed(session, id)
    if product is None:
        raise ResourceNotFound()

    cached_etag = request.headers.get("If-None-Match")
    etag = product.etag
    if cached_etag and etag == cached_etag:
        raise ResourceNotModified()

    cover = None
    if product.medias:
        cover = product.medias[0]

    price = product.prices[0]
    if price_id:
        for p in product.prices:
            if p.id == price_id:
                price = p
                break

    return ProductEmbed.model_validate(
        dict(
            id=product.id,
            name=product.name,
            description=product.description,
            is_recurring=product.is_recurring,
            is_archived=product.is_archived,
            organization_id=product.organization_id,
            cover=cover,
            price=price,
            benefits=product.benefits,
            etag=etag,
        )
    )
