from uuid import UUID

from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.pagination import ListResource, Pagination
from polar.organization.dependencies import OrganizationNamePlatform
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.tags.api import Tags

from .schemas import Article as ArticleSchema
from .schemas import (
    ArticleCreate,
)
from .service import article_service

router = APIRouter(tags=["articles"])


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
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[ArticleSchema]:
    (organization_name, platform) = organization_name_platform
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise ResourceNotFound()

    allow_private_hidden = await authz.can(auth.subject, AccessType.write, org)

    articles = await article_service.list(
        session,
        organization_id=org.id,
        allow_hidden=allow_private_hidden,
        allow_private=allow_private_hidden,
    )

    # TODO: pagination
    count = len(articles)
    return ListResource(
        items=[ArticleSchema.from_db(a) for a in articles],
        pagination=Pagination(total_count=count, max_page=1),
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

    return ArticleSchema.from_db(art)


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

    return ArticleSchema.from_db(art)
