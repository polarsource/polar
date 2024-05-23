from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import Product
from polar.models.product import SubscriptionTierType
from polar.postgres import AsyncSession, get_db_session
from polar.product.schemas import Product as ProductSchema
from polar.product.schemas import ProductBenefitsUpdate, ProductCreate, ProductUpdate
from polar.tags.api import Tags

from . import auth
from .service.product import product as product_service

router = APIRouter(prefix="/products", tags=["products"])

ProductID = Annotated[UUID4, Path(description="The product ID.")]
ProductNotFound = {
    "description": "Product not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", response_model=ListResource[ProductSchema], tags=[Tags.PUBLIC])
async def list_products(
    pagination: PaginationParamsQuery,
    auth_subject: auth.CreatorProductsReadOrAnonymous,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    include_archived: bool = Query(
        False, description="Whether to include archived products."
    ),
    is_recurring: bool | None = Query(
        None,
        description=(
            "Filter on recurring products. "
            "If `true`, only subscriptions tiers are returned. "
            "If `false`, only one-time purchase products are returned. "
        ),
    ),
    benefit_id: UUID4 | None = Query(
        None, description="Filter products granting specific benefit."
    ),
    type: SubscriptionTierType | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[ProductSchema]:
    """List products."""
    results, count = await product_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        include_archived=include_archived,
        is_recurring=is_recurring,
        benefit_id=benefit_id,
        type=type,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [ProductSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    response_model=ProductSchema,
    tags=[Tags.PUBLIC],
    responses={404: ProductNotFound},
)
async def get_product(
    id: ProductID,
    auth_subject: auth.CreatorProductsReadOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    """Get a product by ID."""
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    return product


@router.post(
    "/",
    response_model=ProductSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
    responses={201: {"description": "Product created."}},
)
async def create_product(
    product_create: ProductCreate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    """Create a product."""
    return await product_service.user_create(
        session, authz, product_create, auth_subject
    )


@router.patch(
    "/{id}",
    response_model=ProductSchema,
    tags=[Tags.PUBLIC],
    responses={
        200: {"description": "Product updated."},
        403: {
            "description": "You don't have the permission to update this product.",
            "model": NotPermitted.schema(),
        },
        404: ProductNotFound,
    },
)
async def update_product(
    id: ProductID,
    product_update: ProductUpdate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    """Update a product."""
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    return await product_service.user_update(
        session,
        authz,
        product,
        product_update,
        auth_subject,
    )


@router.post(
    "/{id}/benefits",
    response_model=ProductSchema,
    tags=[Tags.PUBLIC],
    responses={
        200: {"description": "Product updated."},
        403: {
            "description": "You don't have the permission to update this product.",
            "model": NotPermitted.schema(),
        },
        404: ProductNotFound,
    },
)
async def update_product_benefits(
    id: ProductID,
    benefits_update: ProductBenefitsUpdate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    """Update benefits granted by a product."""
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    product, _, _ = await product_service.update_benefits(
        session,
        authz,
        product,
        benefits_update.benefits,
        auth_subject,
    )
    return product
