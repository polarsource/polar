from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from polar.auth.dependencies import Authenticator, WebUser, WebUserOrAnonymous
from polar.auth.models import Anonymous, AuthSubject, User
from polar.auth.scope import Scope
from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.utils import utc_now
from polar.organization.dependencies import OrganizationNamePlatform
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.posthog import posthog
from polar.tags.api import Tags
from polar.user.service import user as user_service
from polar.worker import enqueue_job

from .schemas import Article as ArticleSchema
from .schemas import (
    ArticleCreate,
    ArticleDeleteResponse,
    ArticlePreview,
    ArticlePreviewResponse,
    ArticleReceiversResponse,
    ArticleSentResponse,
    ArticleUnsubscribeResponse,
    ArticleUpdate,
    ArticleViewedResponse,
)
from .service import article_service

router = APIRouter(tags=["articles"])

_ArticlesReadOrAnonymous = Authenticator(
    allowed_subjects={User, Anonymous},
    required_scopes={Scope.web_default, Scope.articles_read},
)
ArticlesReadOrAnonymous = Annotated[
    AuthSubject[Anonymous | User], Depends(_ArticlesReadOrAnonymous)
]


@router.get(
    "/articles/unsubscribe",
    tags=[Tags.INTERNAL],
    response_model=ArticleUnsubscribeResponse,
    description="Unsubscribe user from articles in emails.",
    summary="Unsubscribe user",
    status_code=200,
    responses={404: {}},
)
async def email_unsubscribe(
    article_subscription_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> ArticleUnsubscribeResponse:
    await article_service.unsubscribe(session, article_subscription_id)
    return ArticleUnsubscribeResponse(ok=True)


@router.get(
    "/articles",
    response_model=ListResource[ArticleSchema],
    tags=[Tags.PUBLIC],
    description="List articles.",
    summary="List articles",
    status_code=200,
    responses={404: {}},
)
async def list(
    pagination: PaginationParamsQuery,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    results, count = await article_service.list(
        session, auth_subject.subject, pagination=pagination
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
    "/articles/search",
    response_model=ListResource[ArticleSchema],
    tags=[Tags.PUBLIC],
    description="Search articles.",
    summary="Search articles",
    status_code=200,
    responses={404: {}},
)
async def search(
    organization_name_platform: OrganizationNamePlatform,
    pagination: PaginationParamsQuery,
    auth_subject: ArticlesReadOrAnonymous,
    show_unpublished: bool = Query(
        default=False,
        description="Set to true to also include unpublished articles. Requires the authenticated subject to be an admin in the organization.",
    ),
    is_pinned: bool | None = Query(
        default=None,
        description="Set to true or false to include or exclude pinned articles",
    ),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    results, count = await article_service.search(
        session,
        auth_subject.subject,
        pagination=pagination,
        show_unpublished=show_unpublished,
        organization_id=org.id,
        is_pinned=is_pinned,
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
    "/articles/lookup",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Lookup article.",
    summary="Lookup article",
    status_code=200,
    responses={404: {}},
)
async def lookup(
    slug: str,
    organization_name_platform: OrganizationNamePlatform,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    result = await article_service.get_readable_by_organization_and_slug(
        session, auth_subject.subject, organization_id=org.id, slug=slug
    )
    if not result:
        raise ResourceNotFound()

    art, is_paid_subscriber = result

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(
            auth_subject.subject, AccessType.write, art
        ),
        is_paid_subscriber=is_paid_subscriber,
    )


@router.post(
    "/articles",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Create a new article.",
    summary="Create article",
    status_code=200,
    responses={404: {}},
)
async def create(
    create: ArticleCreate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    org = await organization_service.get(session, create.organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    art = await article_service.create(session, auth_subject.subject, create)
    await session.refresh(art, {"created_by_user", "organization"})

    posthog.auth_subject_event(
        auth_subject, "articles", "api", "create", {"article_id": art.id}
    )

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(
            auth_subject.subject, AccessType.write, art
        ),
        is_paid_subscriber=True,
    )


@router.get(
    "/articles/receivers",
    response_model=ArticleReceiversResponse,
    tags=[Tags.PUBLIC],
    description="Get number of potential receivers for an article.",
    summary="Potential article receivers",
    status_code=200,
    responses={404: {}},
)
async def receivers(
    organization_name_platform: OrganizationNamePlatform,
    auth_subject: WebUser,
    paid_subscribers_only: bool = Query(...),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleReceiversResponse:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    # admin required
    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    (
        free_subscribers,
        premium_subscribers,
        organization_members,
    ) = await article_service.count_receivers(session, org.id, paid_subscribers_only)

    return ArticleReceiversResponse(
        free_subscribers=free_subscribers,
        premium_subscribers=premium_subscribers,
        organization_members=organization_members,
    )


@router.get(
    "/articles/{id}",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Get article.",
    summary="Get article",
    status_code=200,
    responses={404: {}},
)
async def get(
    id: UUID,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    result = await article_service.get_readable_by_id(
        session, auth_subject.subject, id=id
    )
    if not result:
        raise ResourceNotFound()

    art, is_paid_subscriber = result

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(
            auth_subject.subject, AccessType.write, art
        ),
        is_paid_subscriber=is_paid_subscriber,
    )


@router.post(
    "/articles/{id}/viewed",
    response_model=ArticleViewedResponse,
    tags=[Tags.PUBLIC],
    description="Track article view",
    summary="Track article",
    status_code=200,
    responses={404: {}},
)
async def viewed(
    id: UUID,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
) -> ArticleViewedResponse:
    result = await article_service.get_readable_by_id(
        session, auth_subject.subject, id=id
    )
    if not result:
        raise ResourceNotFound()

    # Track view
    # TODO: very simplistic for now, might need some improvements later :-)
    await article_service.track_view(
        session,
        id,
    )

    return ArticleViewedResponse(ok=True)


@router.post(
    "/articles/{id}/send_preview",
    response_model=ArticlePreviewResponse,
    tags=[Tags.PUBLIC],
    description="Send preview email",
    summary="Send preview email",
    status_code=200,
    responses={404: {}},
)
async def send_preview(
    id: UUID,
    preview: ArticlePreview,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticlePreviewResponse:
    result = await article_service.get_readable_by_id(
        session, auth_subject.subject, id=id
    )
    if not result:
        raise ResourceNotFound()

    art, _ = result

    # admin required
    if not await authz.can(auth_subject.subject, AccessType.write, art):
        raise Unauthorized()

    send_to_user = await user_service.get_by_email(session, preview.email)
    if not send_to_user:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject,
        "articles",
        "email_preview",
        "send",
        {"article_id": art.id},
    )

    enqueue_job(
        "articles.send_to_user",
        article_id=art.id,
        user_id=send_to_user.id,
        is_test=True,
    )

    return ArticlePreviewResponse(ok=True)


@router.post(
    "/articles/{id}/send",
    response_model=ArticleSentResponse,
    tags=[Tags.PUBLIC],
    description="Send email to all subscribers",
    summary="Send email to all subscribers",
    status_code=200,
    responses={404: {}},
)
async def send(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSentResponse:
    result = await article_service.get_readable_by_id(
        session, auth_subject.subject, id=id
    )
    if not result:
        raise ResourceNotFound()

    art, _ = result

    # admin required
    if not await authz.can(auth_subject.subject, AccessType.write, art):
        raise Unauthorized()

    posthog.auth_subject_event(
        auth_subject, "articles", "email", "send", {"article_id": art.id}
    )

    await article_service.send_to_subscribers(session, art)
    return ArticleSentResponse(ok=True)


@router.put(
    "/articles/{id}",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Update an article.",
    summary="Update an article",
    status_code=200,
    responses={404: {}},
)
async def update(
    id: UUID,
    update: ArticleUpdate,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    result = await article_service.get_readable_by_id(
        session, auth_subject.subject, id=id
    )
    if not result:
        raise ResourceNotFound()

    article, _ = result

    if not await authz.can(auth_subject.subject, AccessType.write, article):
        raise Unauthorized()

    await article_service.update(session, article, update)

    # get for return
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    posthog.auth_subject_event(
        auth_subject, "articles", "api", "update", {"article_id": art.id}
    )

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(
            auth_subject.subject, AccessType.write, art
        ),
        # TODO
        is_paid_subscriber=await authz.can(auth_subject.subject, AccessType.write, art),
    )


@router.delete(
    "/articles/{id}",
    response_model=ArticleDeleteResponse,
    tags=[Tags.PUBLIC],
    description="Delete an article.",
    summary="Delete an article",
    status_code=200,
    responses={404: {}},
)
async def delete(
    id: UUID,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleDeleteResponse:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, art):
        raise Unauthorized()

    art.deleted_at = utc_now()
    session.add(art)

    posthog.auth_subject_event(
        auth_subject, "articles", "api", "delete", {"article_id": art.id}
    )

    return ArticleDeleteResponse(ok=True)
