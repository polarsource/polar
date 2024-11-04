from typing import Annotated

from fastapi import Depends, Query

from polar.authz.service import Authz
from polar.benefit.schemas import BenefitID
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.kit.sorting import Sorting, SortingGetter
from polar.models import Product
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import Product as ProductSchema
from .schemas import ProductBenefitsUpdate, ProductCreate, ProductID, ProductUpdate
from .service.product import product as product_service
from .sorting import ProductSortProperty

router = APIRouter(
    prefix="/products", tags=["products", APITag.documented, APITag.featured]
)

ProductNotFound = {
    "description": "Product not found.",
    "model": ResourceNotFound.schema(),
}


ListSorting = Annotated[
    list[Sorting[ProductSortProperty]],
    Depends(SortingGetter(ProductSortProperty, ["-created_at"])),
]


@router.get("/", summary="List Products", response_model=ListResource[ProductSchema])
async def list(
    pagination: PaginationParamsQuery,
    sorting: ListSorting,
    auth_subject: auth.CreatorProductsRead,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    query: str | None = Query(None, description="Filter by product name."),
    is_archived: bool | None = Query(None, description="Filter on archived products."),
    is_recurring: bool | None = Query(
        None,
        description=(
            "Filter on recurring products. "
            "If `true`, only subscriptions tiers are returned. "
            "If `false`, only one-time purchase products are returned. "
        ),
    ),
    benefit_id: MultipleQueryFilter[BenefitID] | None = Query(
        None,
        title="BenefitID Filter",
        description="Filter products granting specific benefit.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[ProductSchema]:
    """List products."""
    results, count = await product_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        query=query,
        is_archived=is_archived,
        is_recurring=is_recurring,
        benefit_id=benefit_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [ProductSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Product",
    response_model=ProductSchema,
    responses={404: ProductNotFound},
)
async def get(
    id: ProductID,
    auth_subject: auth.CreatorProductsRead,
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
    summary="Create Product",
    responses={201: {"description": "Product created."}},
)
async def create(
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
    summary="Update Product",
    responses={
        200: {"description": "Product updated."},
        403: {
            "description": "You don't have the permission to update this product.",
            "model": NotPermitted.schema(),
        },
        404: ProductNotFound,
    },
)
async def update(
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
    summary="Update Product Benefits",
    responses={
        200: {"description": "Product benefits updated."},
        403: {
            "description": "You don't have the permission to update this product.",
            "model": NotPermitted.schema(),
        },
        404: ProductNotFound,
    },
)
async def update_benefits(
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
