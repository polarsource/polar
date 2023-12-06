from uuid import UUID

from fastapi import APIRouter, Depends, Query

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, Pagination
from polar.kit.utils import utc_now
from polar.organization.dependencies import OrganizationNamePlatform
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.tags.api import Tags
from polar.user.service import user as user_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .schemas import Article as ArticleSchema
from .schemas import (
    ArticleCreate,
    ArticleDeleteResponse,
    ArticlePreview,
    ArticlePreviewResponse,
    ArticleSentResponse,
    ArticleUpdate,
    ArticleViewedResponse,
)
from .service import article_service

router = APIRouter(tags=["articles"])


@router.get(
    "/articles",
    response_model=ListResource[ArticleSchema],
    tags=[Tags.PUBLIC],
    description="List articles.",
    summary="List articles (Public API)",
    status_code=200,
    responses={404: {}},
)
async def list(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    # orgs that the user is a member of
    org_memberships = await user_organization_service.list_by_user_id(
        session, auth.subject.id
    )

    # TODO: list articles based on subscriptions/benefits/etc...

    articles = await article_service.list(
        session,
        organization_ids=[o.organization_id for o in org_memberships],
        can_see_unpublished_in_organization_ids=[],
    )

    # TODO: pagination
    count = len(articles)
    return ListResource(
        items=[
            ArticleSchema.from_db(
                a,
                include_admin_fields=await authz.can(auth.subject, AccessType.write, a),
                # TODO
                is_paid_subscriber=await authz.can(auth.subject, AccessType.write, a),
            )
            for a in articles
        ],
        pagination=Pagination(total_count=count, max_page=1),
    )


@router.get(
    "/articles/search",
    response_model=ListResource[ArticleSchema],
    tags=[Tags.PUBLIC],
    description="Search articles.",
    summary="Search articles (Public API)",
    status_code=200,
    responses={404: {}},
)
async def search(
    organization_name_platform: OrganizationNamePlatform,
    show_unpublished: bool | None = Query(
        default=None,
        description="Set to true to also include unpublished articles. Requires the authenticated subject to be an admin in the organization.",
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    allow_private_hidden = show_unpublished and await authz.can(
        auth.subject, AccessType.write, org
    )

    articles = await article_service.list(
        session,
        organization_id=org.id,
        can_see_unpublished_in_organization_ids=[org.id]
        if allow_private_hidden
        else None,
    )

    # TODO: pagination
    count = len(articles)
    return ListResource(
        items=[
            ArticleSchema.from_db(
                a,
                include_admin_fields=await authz.can(auth.subject, AccessType.write, a),
                # TODO
                is_paid_subscriber=await authz.can(auth.subject, AccessType.write, a),
            )
            for a in articles
        ],
        pagination=Pagination(total_count=count, max_page=1),
    )


@router.get(
    "/articles/lookup",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Lookup article.",
    summary="Lookup article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def lookup(
    slug: str,
    organization_name_platform: OrganizationNamePlatform,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    art = await article_service.get_by_slug(session, organization_id=org.id, slug=slug)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, art):
        raise Unauthorized()

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(auth.subject, AccessType.write, art),
        # TODO
        is_paid_subscriber=await authz.can(auth.subject, AccessType.write, art),
    )


@router.post(
    "/articles",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Create a new article.",
    summary="Create article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def create(
    create: ArticleCreate,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    org = await organization_service.get(session, create.organization_id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, org):
        raise Unauthorized()

    created = await article_service.create(session, auth.subject, create)

    # get for return
    art = await article_service.get_loaded(session, created.id)
    if not art:
        raise ResourceNotFound()

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(auth.subject, AccessType.write, art),
        # TODO
        is_paid_subscriber=await authz.can(auth.subject, AccessType.write, art),
    )


@router.get(
    "/articles/{id}",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Get article.",
    summary="Get article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def get(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
) -> ArticleSchema:
    # TODO: authz, private, hidden, access by benefits, etc...

    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, art):
        raise Unauthorized()

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(auth.subject, AccessType.write, art),
        # TODO
        is_paid_subscriber=await authz.can(auth.subject, AccessType.write, art),
    )


@router.post(
    "/articles/{id}/viewed",
    response_model=ArticleViewedResponse,
    tags=[Tags.PUBLIC],
    description="Track article view",
    summary="Track article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def viewed(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
) -> ArticleViewedResponse:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, art):
        raise Unauthorized()

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
    summary="Send preview email (Public API)",
    status_code=200,
    responses={404: {}},
)
async def send_preview(
    id: UUID,
    preview: ArticlePreview,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticlePreviewResponse:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    # admin required
    if not await authz.can(auth.subject, AccessType.write, art):
        raise Unauthorized()

    send_to_user = await user_service.get_by_email(session, preview.email)
    if not send_to_user:
        raise ResourceNotFound()

    await enqueue_job(
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
    summary="Send email to all subscribers (Public API)",
    status_code=200,
    responses={404: {}},
)
async def send(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSentResponse:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    # admin required
    if not await authz.can(auth.subject, AccessType.write, art):
        raise Unauthorized()

    await article_service.send_to_subscribers(session, art)
    return ArticleSentResponse(ok=True)


@router.put(
    "/articles/{id}",
    response_model=ArticleSchema,
    tags=[Tags.PUBLIC],
    description="Update an article.",
    summary="Update an article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def update(
    id: UUID,
    update: ArticleUpdate,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleSchema:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, art):
        raise Unauthorized()

    await article_service.update(session, art, update)

    # get for return
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    return ArticleSchema.from_db(
        art,
        include_admin_fields=await authz.can(auth.subject, AccessType.write, art),
        # TODO
        is_paid_subscriber=await authz.can(auth.subject, AccessType.write, art),
    )


@router.delete(
    "/articles/{id}",
    response_model=ArticleDeleteResponse,
    tags=[Tags.PUBLIC],
    description="Delete an article.",
    summary="Delete an article (Public API)",
    status_code=200,
    responses={404: {}},
)
async def delete(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ArticleDeleteResponse:
    art = await article_service.get_loaded(session, id)
    if not art:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, art):
        raise Unauthorized()

    art.deleted_at = utc_now()
    await art.save(session)

    return ArticleDeleteResponse(ok=True)
