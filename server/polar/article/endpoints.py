from typing import Annotated
from uuid import UUID

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models.article import ArticleVisibility
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import Article as ArticleSchema
from .schemas import ArticleCreate, ArticlePreview, ArticleReceivers, ArticleUpdate
from .service import article_service

router = APIRouter(tags=["articles"], prefix="/articles")


ArticleID = Annotated[UUID4, Path(description="The article ID.")]
ArticleNotFound = {
    "description": "Article not found.",
    "model": ResourceNotFound.schema(),
}


@router.get("/", summary="List Articles", response_model=ListResource[ArticleSchema])
async def list(
    auth_subject: auth.ArticlesReadOrAnonymous,
    pagination: PaginationParamsQuery,
    organization_id: UUID4 | None = Query(
        None, description="Filter by organization ID."
    ),
    slug: str | None = Query(None, description="Filter by slug."),
    visibility: ArticleVisibility | None = Query(
        None, description="Filter by visibility."
    ),
    is_published: bool | None = Query(None, description="Filter by published status."),
    is_pinned: bool | None = Query(None, description="Filter by pinned status."),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    """List articles."""
    results, count = await article_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        slug=slug,
        visibility=visibility,
        is_published=is_published,
        is_pinned=is_pinned,
        pagination=pagination,
    )

    return ListResource.from_paginated_results(
        [
            ArticleSchema.from_db(
                art,
                include_admin_fields=await authz.can(
                    auth_subject.subject, AccessType.write, art
                ),
                is_paid_subscriber=is_paid_subscriber,
            )
            for art, is_paid_subscriber in results
        ],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Article",
    response_model=ArticleSchema,
    responses={404: ArticleNotFound},
)
async def get(
    id: ArticleID,
    auth_subject: auth.ArticlesReadOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    """Get an article by ID."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, is_paid_subscriber = result

    return ArticleSchema.from_db(
        article,
        include_admin_fields=await authz.can(
            auth_subject.subject, AccessType.write, article
        ),
        is_paid_subscriber=is_paid_subscriber,
    )


@router.post(
    "/",
    summary="Create Article",
    response_model=ArticleSchema,
    status_code=201,
    responses={201: {"description": "Article created."}},
)
async def create(
    body: ArticleCreate,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    """Create an article."""
    article = await article_service.create(session, authz, body, auth_subject)
    return ArticleSchema.from_db(
        article, include_admin_fields=True, is_paid_subscriber=True
    )


@router.patch(
    "/{id}",
    summary="Update Article",
    response_model=ArticleSchema,
    responses={
        200: {"description": "Article updated."},
        403: {
            "description": "You don't have the permission to update this article.",
            "model": NotPermitted.schema(),
        },
        404: ArticleNotFound,
    },
)
async def update(
    id: ArticleID,
    body: ArticleUpdate,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    """Update an article."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, _ = result

    updated_article = await article_service.update(
        session, authz, article, body, auth_subject
    )

    return ArticleSchema.from_db(
        updated_article, include_admin_fields=True, is_paid_subscriber=True
    )


@router.delete(
    "/{id}",
    summary="Delete Article",
    status_code=204,
    responses={
        204: {"description": "Article deleted."},
        403: {
            "description": "You don't have the permission to delete this article.",
            "model": NotPermitted.schema(),
        },
        404: ArticleNotFound,
    },
)
async def delete(
    id: ArticleID,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """Delete an article."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, _ = result

    await article_service.delete(session, authz, article, auth_subject)

    return None


@router.get(
    "/{id}/receivers",
    summary="Get Article Receivers Count",
    response_model=ArticleReceivers,
)
async def get_receivers(
    id: ArticleID,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleReceivers:
    """Get number of potential receivers for an article."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, _ = result

    (
        free_subscribers,
        premium_subscribers,
        organization_members,
    ) = await article_service.count_receivers(session, authz, article, auth_subject)

    return ArticleReceivers(
        free_subscribers=free_subscribers,
        premium_subscribers=premium_subscribers,
        organization_members=organization_members,
    )


@router.post(
    "/{id}/preview",
    summary="Send Article Preview",
    status_code=202,
    responses={
        202: {"description": "Article preview sent."},
        403: {
            "description": "You don't have the permission to manage this article.",
            "model": NotPermitted.schema(),
        },
        404: ArticleNotFound,
    },
)
async def send_preview(
    id: ArticleID,
    body: ArticlePreview,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """Send an article preview by email."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, _ = result

    await article_service.preview(session, authz, article, body, auth_subject)

    return None


@router.post(
    "/{id}/send",
    summary="Send Article",
    status_code=202,
    responses={
        202: {"description": "Article sent to subscribers."},
        400: {
            "description": "Article is either not published, already sent or not ready to be sent."
        },
        403: {
            "description": "You don't have the permission to manage this article.",
            "model": NotPermitted.schema(),
        },
        404: ArticleNotFound,
    },
)
async def send(
    id: ArticleID,
    auth_subject: auth.ArticlesWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> None:
    """Send an article by email to all subscribers."""
    result = await article_service.get_by_id(session, auth_subject, id)

    if result is None:
        raise ResourceNotFound()

    article, _ = result

    await article_service.send(session, authz, article, auth_subject)

    return None


@router.get("/unsubscribe", include_in_schema=IN_DEVELOPMENT_ONLY, status_code=204)
async def email_unsubscribe(
    article_subscription_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await article_service.unsubscribe(session, article_subscription_id)
    return None
