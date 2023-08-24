from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar.auth.dependencies import Auth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import NotPermitted, ResourceNotFound, StripeError
from polar.issue.schemas import Issue
from polar.models import Pledge, Repository
from polar.organization.schemas import Organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.schemas import Repository as RepositorySchema
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.types import ListResource
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    Pledge as PledgeSchema,
)
from .schemas import (
    PledgeCreate,
    PledgeMutationResponse,
    PledgeRead,
    PledgeResources,
    PledgeUpdate,
)
from .service import pledge as pledge_service

router = APIRouter(tags=["pledges"])


@router.get(
    "/pledges/search",
    response_model=ListResource[PledgeSchema],
    tags=[Tags.PUBLIC],
    description="Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).",  # noqa: E501
    summary="Search pledges (Public API)",
    status_code=200,
)
async def search(
    platform: Platforms | None = None,
    organization_name: str
    | None = Query(
        default=None,
        min_length=1,
        example="my-org",
        description="Search pledges in the organization with this name. Requires platform to be set.",  # noqa: E501
    ),
    repository_name: str
    | None = Query(
        default=None,
        min_length=1,
        example="my-repo",
        description="Search pledges in the repository with this name. Can only be used if organization_name is set.",  # noqa: E501
    ),
    issue_id: UUID
    | None = Query(default=None, description="Search pledges to this issue"),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[PledgeSchema]:
    list_by_orgs: list[UUID] = []
    list_by_repos: list[UUID] = []
    list_by_issues: list[UUID] = []

    if organization_name:
        if not platform:
            raise HTTPException(
                status_code=400,
                detail="platform is not set",
            )

        if not platform:
            raise HTTPException(
                status_code=400,
                detail="platform is not set",
            )

        if not organization_name:
            raise HTTPException(
                status_code=400,
                detail="organization_name is not set",
            )

        # get org
        org = await organization_service.get_by_name(
            session,
            platform=Platforms.github,
            name=organization_name,
        )

        if not org:
            raise HTTPException(
                status_code=404,
                detail="organization not found",
            )

        list_by_orgs = [org.id]

    if repository_name:
        if len(list_by_orgs) != 1:
            raise HTTPException(
                status_code=404,
                detail="organization not set",
            )

        repo = await repository_service.get_by_org_and_name(
            session, organization_id=list_by_orgs[0], name=repository_name
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="repository not found",
            )

        list_by_repos = [repo.id]

    if issue_id:
        list_by_issues = [issue_id]

    if len(list_by_orgs) == 0 and len(list_by_repos) == 0 and len(list_by_issues) == 0:
        raise HTTPException(
            status_code=400,
            detail="No search criteria specified",
        )

    pledges = await pledge_service.list_by(
        session=session,
        organization_ids=list_by_orgs,
        repository_ids=list_by_repos,
        issue_ids=list_by_issues,
        load_issue=True,
    )

    return ListResource(
        items=[
            PledgeSchema.from_db(p)
            for p in pledges
            if await authz.can(auth.subject, AccessType.read, p)
        ]
    )


@router.get(
    "/pledges/{id}",
    response_model=PledgeSchema,
    tags=[Tags.PUBLIC],
    description="Get a pledge. Requires authentication.",  # noqa: E501
    summary="Get pledge (Public API)",
    status_code=200,
)
async def get(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get_with_loaded(session, id)
    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )

    if not await authz.can(auth.subject, AccessType.read, pledge):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return PledgeSchema.from_db(pledge)


# Internal APIs below


async def get_pledge_or_404(
    session: AsyncSession,
    *,
    pledge_id: UUID,
    for_repository: Repository,
) -> Pledge:
    pledge = await pledge_service.get_with_loaded(session=session, pledge_id=pledge_id)

    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )

    if pledge.repository_id != for_repository.id:
        raise HTTPException(
            status_code=403, detail="Pledge does not belong to this repository"
        )

    return pledge


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledge",
    response_model=PledgeResources,
)
async def get_pledge_with_resources(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    # Mimic JSON-API's include query format
    include: str = "organization,repository,issue",
    session: AsyncSession = Depends(get_db_session),
) -> PledgeResources:
    includes = include.split(",")

    try:
        org, repo, issue = await organization_service.get_with_repo_and_issue(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            issue=number,
        )
    except ResourceNotFound as e:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        ) from e

    pledge = await get_pledge_or_404(
        session,
        pledge_id=pledge_id,
        for_repository=repo,
    )
    included_pledge = PledgeRead.from_db(pledge)

    included_org = None
    if "organization" in includes:
        included_org = Organization.from_db(org)

    included_repo = None
    if "repository" in includes:
        included_repo = RepositorySchema.from_db(repo)

    included_issue = Issue.from_db(issue) if "issue" in includes else None
    return PledgeResources(
        pledge=included_pledge,
        organization=included_org,
        repository=included_repo,
        issue=included_issue,
    )


@router.post(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges",
    response_model=PledgeMutationResponse,
    status_code=200,
    responses={
        400: {"detail": "message"},
        403: {"detail": "message"},
        404: {"detail": "message"},
    },
)
async def create_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> PledgeMutationResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    try:
        return await pledge_service.create_pledge(
            user=auth.user,
            org=org,
            repo=repo,
            issue=issue,
            pledge=pledge,
            session=session,
        )
    except ResourceNotFound as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        ) from e
    except NotPermitted as e:
        raise HTTPException(
            status_code=403,
            detail=str(e),
        ) from e
    except StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeRead,
)
async def get_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.current_user),
    authz: Authz = Depends(Authz.authz),
) -> PledgeRead:
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    if not await authz.can(auth.subject, AccessType.read, pledge):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return PledgeRead.from_db(pledge)


@router.patch(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeMutationResponse,
)
async def update_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    updates: PledgeUpdate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> PledgeMutationResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    return await pledge_service.modify_pledge(
        session=session,
        repo=repo,
        user=auth.user,
        pledge_id=pledge_id,
        updates=updates,
    )


@router.get(
    "/me/pledges",
    response_model=list[PledgeRead],
)
async def list_personal_pledges(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeRead]:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    pledges = await pledge_service.list_by_pledging_user(session, auth.user.id)
    return [PledgeRead.from_db(p) for p in pledges]


@router.get(
    "/{platform}/{org_name}/pledges",
    response_model=list[PledgeResources],
)
async def list_organization_pledges(
    platform: Platforms,
    org_name: str,
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeResources]:
    pledges = await pledge_service.list_by_receiving_organization(
        session, auth.organization.id
    )
    return [
        PledgeResources(
            pledge=PledgeRead.from_db(p),
            issue=Issue.from_db(p.issue),
            repository=RepositorySchema.from_db(p.to_repository),
            organization=Organization.from_db(p.to_organization),
        )
        for p in pledges
    ]


@router.post(
    "/pledges/{pledge_id}/dispute",
    response_model=PledgeRead,
)
async def dispute_pledge(
    pledge_id: UUID,
    reason: str,
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    pledge = await pledge_service.get(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    # authorize
    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_sender_pledge(
        auth.user, pledge, user_memberships
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    await pledge_service.mark_disputed(
        session, pledge_id=pledge_id, by_user_id=auth.user.id, reason=reason
    )

    # get pledge again
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    return PledgeRead.from_db(pledge)
