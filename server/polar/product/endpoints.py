from fastapi import Depends, Query
from pydantic import UUID4

from polar.authz.service import Authz
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import Product
from polar.models.product import SubscriptionTierType
from polar.organization.dependencies import ResolvedOrganization
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.product.schemas import Product as ProductSchema
from polar.product.schemas import ProductBenefitsUpdate, ProductCreate, ProductUpdate
from polar.tags.api import Tags

from . import auth
from .service.product import product as product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get(
    "/search",
    response_model=ListResource[ProductSchema],
    tags=[Tags.PUBLIC],
)
async def search_products(
    pagination: PaginationParamsQuery,
    organization: ResolvedOrganization,
    auth_subject: auth.CreatorProductsReadOrAnonymous,
    include_archived: bool = Query(False),
    type: SubscriptionTierType | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[ProductSchema]:
    results, count = await product_service.search(
        session,
        auth_subject,
        type=type,
        organization=organization,
        include_archived=include_archived,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [ProductSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/lookup",
    response_model=ProductSchema,
    tags=[Tags.PUBLIC],
)
async def lookup_product(
    product_id: UUID4,
    auth_subject: auth.CreatorProductsReadOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    subscription_tier = await product_service.get_by_id(
        session, auth_subject, product_id
    )

    if subscription_tier is None:
        raise ResourceNotFound()

    return subscription_tier


@router.post(
    "/",
    response_model=ProductSchema,
    status_code=201,
    tags=[Tags.PUBLIC],
)
async def create_product(
    product_create: ProductCreate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    return await product_service.user_create(
        session, authz, product_create, auth_subject
    )


@router.post("/{id}", response_model=ProductSchema, tags=[Tags.PUBLIC])
async def update_product(
    id: UUID4,
    product_update: ProductUpdate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    if product.type != SubscriptionTierType.free:
        if product_update.prices is not None and len(product_update.prices) < 1:
            raise BadRequest("Paid tiers must have at least one price")

    posthog.auth_subject_event(
        auth_subject,
        "subscriptions",
        "tier",
        "update",
        {"subscription_tier_id": product.id},
    )

    return await product_service.user_update(
        session,
        authz,
        product,
        product_update,
        auth_subject,
    )


@router.post("/{id}/archive", response_model=ProductSchema, tags=[Tags.PUBLIC])
async def archive_product(
    id: UUID4,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject,
        "subscriptions",
        "tier",
        "archive",
        {"subscription_tier_id": product.id},
    )

    return await product_service.archive(session, authz, product, auth_subject)


@router.post("/{id}/benefits", response_model=ProductSchema, tags=[Tags.PUBLIC])
async def update_product_benefits(
    id: UUID4,
    benefits_update: ProductBenefitsUpdate,
    auth_subject: auth.CreatorProductsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Product:
    product = await product_service.get_by_id(session, auth_subject, id)

    if product is None:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject,
        "subscriptions",
        "tier_benefits",
        "update",
        {"subscription_tier_id": product.id},
    )

    product, _, _ = await product_service.update_benefits(
        session,
        authz,
        product,
        benefits_update.benefits,
        auth_subject,
    )
    return product
