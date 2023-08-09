from typing import Sequence
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.dashboard.schemas import IssueListType
from polar.enums import Platforms
from polar.issue.service import (
    issue as issue_service,
)
from polar.models.repository import Repository as RepositoryModel
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags
from polar.types import ListResource
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.visibility import Visibility

from .schemas import (
    Repository as RepositorySchema,
)
from .schemas import (
    RepositorySeeksFundingShield,
)
from .service import repository

log = structlog.get_logger()

router = APIRouter(tags=["repositories"])


async def user_can_read(
    session: AsyncSession,
    auth: Auth,
    repository: RepositoryModel,
) -> bool:
    if repository.visibility == Visibility.PUBLIC:
        return True

    if not auth.user:
        return False

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    ids = [m.organization_id for m in user_memberships]

    if repository.organization_id in ids:
        return True

    return False


async def user_can_write(
    session: AsyncSession,
    auth: Auth,
    repository: RepositoryModel,
) -> bool:
    if not auth.user:
        return False

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    ids = [m.organization_id for m in user_memberships if m.is_admin is True]

    if repository.organization_id in ids:
        return True

    return False


@router.get(
    "/repositories",
    response_model=ListResource[RepositorySchema],
    tags=[Tags.PUBLIC],
    description="List repositories in organizations that the authenticated user is a member of. Requires authentication.",  # noqa: E501
    summary="List repositories (Public API)",
    status_code=200,
)
async def list(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[RepositorySchema]:
    orgs = await organization_service.list_all_orgs_by_user_id(session, auth.user.id)
    repos = await repository.list_by(
        session, org_ids=[o.id for o in orgs], load_organization=True
    )
    return ListResource(items=[RepositorySchema.from_db(r) for r in repos])


@router.get(
    "/repositories/search",
    response_model=ListResource[RepositorySchema],
    tags=[Tags.PUBLIC],
    description="Search repositories.",
    summary="Search repositories (Public API)",
    status_code=200,
    responses={404: {}},
)
async def search(
    platform: Platforms,
    organization_name: str,
    repository_name: str | None = None,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[RepositorySchema]:
    org = await organization_service.get_by_name(
        session,
        platform=platform,
        name=organization_name,
    )
    if not org:
        return (
            ListResource()
        )  # search endpoints returns empty lists in case of no matches

    repos = await repository.list_by(
        session,
        org_ids=[org.id],
        load_organization=True,
        repository_name=repository_name,
    )

    # Anonymous requests can only see public repositories,
    # authed users can also see private repositories in orgs that they are a
    # member of
    repos = [r for r in repos if await user_can_read(session, auth, r)]

    return ListResource(items=[RepositorySchema.from_db(r) for r in repos])


@router.get(
    "/repositories/lookup",
    response_model=RepositorySchema,
    tags=[Tags.PUBLIC],
    description="Lookup repositories. Like search but returns at only one repository.",  # noqa: E501
    summary="Lookup repositories (Public API)",
    status_code=200,
    responses={404: {}},
)
async def lookup(
    platform: Platforms,
    organization_name: str,
    repository_name: str,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> RepositorySchema:
    org = await organization_service.get_by_name(
        session,
        platform=platform,
        name=organization_name,
    )
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    repo = await repository.get_by_org_and_name(
        session,
        organization_id=org.id,
        name=repository_name,
        load_organization=True,
    )

    if not repo or not await user_can_read(session, auth, repo):
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    return RepositorySchema.from_db(repo)


@router.get(
    "/repositories/{id}",
    response_model=RepositorySchema,
    tags=[Tags.PUBLIC],
    description="Get a repository",
    status_code=200,
    summary="Get a repository (Public API)",
    responses={404: {}},
)
async def get(
    id: UUID,
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> RepositorySchema:
    repo = await repository.get(session, id=id, load_organization=True)

    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    if not await user_can_read(session, auth, repo):
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    if repo:
        return RepositorySchema.from_db(repo)

    raise HTTPException(
        status_code=404,
        detail="Repository not found",
    )
