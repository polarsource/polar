from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.dashboard.schemas import IssueSortBy
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.client import get_polar_client
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.github.service.url import github_url
from polar.issue.body import IssueBodyRenderer, get_issue_body_renderer
from polar.kit.pagination import ListResource, Pagination
from polar.locker import Locker, get_locker
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import (
    AsyncSession,
    AsyncSessionMaker,
    get_db_session,
    get_db_sessionmaker,
)
from polar.repository.schemas import Repository as RepositorySchema
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .schemas import (
    ConfirmIssue,
    IssueUpdateBadgeMessage,
    PostIssueComment,
    UpdateIssue,
)
from .schemas import Issue as IssueSchema
from .service import issue as issue_service

router = APIRouter(tags=["issues"])


@router.get(
    "/issues/search",
    response_model=ListResource[IssueSchema],
    tags=[Tags.PUBLIC],
    description="Search issues.",
    summary="Search issues (Public API)",
    status_code=200,
    responses={404: {}},
)
async def search(
    platform: Platforms,
    organization_name: str,
    repository_name: str | None = None,
    sort: IssueSortBy = Query(
        default=IssueSortBy.issues_default, description="Issue sorting method"
    ),
    have_pledge: bool | None = Query(
        default=None,
        description="Set to true to only return issues that have a pledge behind them",
    ),
    have_badge: bool | None = Query(
        default=None,
        description="Set to true to only return issues that have the Polar badge in the issue description",  # noqa: E501
    ),
    github_milestone_number: int | None = Query(
        default=None,
        description="Filter to only return issues connected to this GitHub milestone.",
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[IssueSchema]:
    org = await organization_service.get_by_name(session, platform, organization_name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    all_org_repos = await repository_service.list_by(
        session,
        org_ids=[org.id],
    )
    all_org_repos = [
        r for r in all_org_repos if r.is_private is False and r.is_archived is False
    ]

    if repository_name:
        repo = await repository_service.get_by(
            session,
            organization_id=org.id,
            name=repository_name,
            is_private=False,
            is_archived=False,
            deleted_at=None,
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )

        issues_in_repos = [repo]
    else:
        issues_in_repos = all_org_repos

    issues_in_repos_ids = [r.id for r in issues_in_repos]

    (issues, count) = await issue_service.list_by_repository_type_and_status(
        session=session,
        repository_ids=issues_in_repos_ids,
        sort_by=sort,
        limit=50,
        load_repository=True,
        have_pledge=have_pledge,
        have_polar_badge=have_badge,
    )

    return ListResource(
        items=[
            IssueSchema.from_db(i)
            for i in issues
            if await authz.can(auth.subject, AccessType.read, i)
        ],
        pagination=Pagination(total_count=count, max_page=1),
    )


@router.get(
    "/issues/lookup",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
)
async def lookup(
    external_url: str | None = Query(
        default=None,
        description="URL to issue on external source",
        example="https://github.com/polarsource/polar/issues/897",
    ),
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> IssueSchema:
    if not external_url:
        raise HTTPException(
            status_code=400,
            detail="No search parameter specified",
        )

    if external_url:
        urls = github_url.parse_urls(external_url)
        if len(urls) != 1:
            raise HTTPException(
                status_code=400,
                detail="Invalid external_url",
            )

        url = urls[0]

        if not url.owner or not url.repo:
            raise HTTPException(
                status_code=400,
                detail="Invalid external_url",
            )

        client = get_polar_client()

        async with locker.lock(
            f"sync_external_{url.owner}_{url.repo}_{url.number}",
            timeout=10.0,
            blocking_timeout=10.0,
        ):
            tmp_issue = (
                await github_issue_service.sync_external_org_with_repo_and_issue(
                    session,
                    client=client,
                    org_name=url.owner,
                    repo_name=url.repo,
                    issue_number=url.number,
                )
            )

        # get for return
        issue = await issue_service.get_loaded(session, tmp_issue.id)
        if not issue:
            raise ResourceNotFound("Issue not found")

        if not await authz.can(auth.subject, AccessType.read, issue):
            raise Unauthorized()

        return IssueSchema.from_db(issue)

    raise ResourceNotFound("Issue not found")


@router.get(
    "/issues/{id}/body",
    tags=[Tags.PUBLIC],
)
async def get_body(
    id: UUID,
    authz: Authz = Depends(Authz.authz),
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
    issue_body_renderer: IssueBodyRenderer = Depends(get_issue_body_renderer),
) -> HTMLResponse:
    issue = await issue_service.get_loaded(session, id)
    if issue is None:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, issue):
        raise Unauthorized()

    content = await issue_body_renderer.render(
        issue, issue.repository, issue.repository.organization
    )

    return HTMLResponse(content=content)


@router.get(
    "/issues/for_you",
    response_model=ListResource[IssueSchema],
    tags=[Tags.INTERNAL],
)
async def for_you(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
) -> ListResource[IssueSchema]:
    issues = await github_issue_service.list_issues_from_starred(
        session, sessionmaker, auth.user
    )

    # get loaded
    issues = [
        i for i in [await issue_service.get_loaded(session, i.id) for i in issues] if i
    ]
    items = [IssueSchema.from_db(i) for i in issues]

    # sort
    items.sort(
        key=lambda i: i.reactions.plus_one if i.reactions else 0,
        reverse=True,
    )

    # hacky solution to spread out the repositories in the results
    def spread(items: list[IssueSchema]) -> list[IssueSchema]:
        penalties: dict[str, int] = {}
        res: list[IssueSchema] = []

        while len(items) > 0:
            # In the next 5 issues, pick the one with the lowest penalty
            lowest_penalty = 0
            lowest: IssueSchema | None = None
            lowest_idx = 0

            for idx, candidate in enumerate(items[0:5]):
                pen = penalties.get(candidate.repository.name, 0)

                if lowest is None or pen < lowest_penalty:
                    lowest = candidate
                    lowest_penalty = pen
                    lowest_idx = idx

            if lowest is None:
                break

            # if lowest is not None:
            penalties[lowest.repository.name] = lowest_penalty + 1
            res.append(lowest)
            del items[lowest_idx]

        return res

    items = spread(items)

    return ListResource(
        items=items, pagination=Pagination(total_count=len(items), max_page=1)
    )


@router.get(
    "/issues/{id}",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Get issue",
    summary="Get issue (Public API)",
)
async def get(
    id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth.subject, AccessType.read, issue):
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Update issue. Requires authentication.",
    summary="Update issue. (Public API)",
)
async def update(
    id: UUID,
    update: UpdateIssue,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    updated = False

    if update.funding_goal:
        if update.funding_goal.currency != "USD":
            raise HTTPException(
                status_code=400,
                detail="Unexpected currency. Currency must be USD.",
            )

        issue.funding_goal = update.funding_goal.amount
        updated = True

    if update.set_upfront_split_to_contributors:
        issue.upfront_split_to_contributors = update.upfront_split_to_contributors
        updated = True

    if updated:
        await issue.save(session)

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}/confirm_solved",
    response_model=IssueSchema,
    tags=[Tags.PUBLIC],
    description="Mark an issue as confirmed solved, and configure issue reward splits. Enables payouts of pledges. Can only be done once per issue. Requires authentication.",  # noqa: E501
    summary="Mark an issue as confirmed solved. (Public API)",
)
async def confirm(
    id: UUID,
    body: ConfirmIssue,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_received_pledge_on_issue(
        issue, user_memberships
    ):
        raise HTTPException(
            status_code=401,
            detail="Access denied",
        )

    try:
        await pledge_service.create_issue_rewards(
            session, issue_id=issue.id, splits=body.splits
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Failed to set splits, invalid configuration, or this issue might already be confirmed.",  # noqa: E501
        ) from e

    # mark issue as confirmed
    await issue_service.mark_confirmed_solved(
        session, issue_id=issue.id, by_user_id=auth.user.id
    )

    # mark pledges as PENDING
    await pledge_service.mark_pending_by_issue_id(session, issue_id=issue.id)

    await pledge_service.issue_confirmed_discord_alert(issue=issue)

    # get for return
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue)


#
# Internal APIs below
#


@router.post(
    "/issues/{id}/add_badge",
    response_model=IssueSchema,
    tags=[Tags.INTERNAL],
)
async def add_polar_badge(
    id: UUID,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise Unauthorized()

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.add_polar_label(session, org, repo, issue)

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/remove_badge",
    response_model=IssueSchema,
)
async def remove_polar_badge(
    id: UUID,
    auth: UserRequiredAuth,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise Unauthorized()

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.remove_polar_label(session, org, repo, issue)

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/comment",
    response_model=IssueSchema,
    tags=[Tags.INTERNAL],
)
async def add_issue_comment(
    id: UUID,
    comment: PostIssueComment,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise Unauthorized()

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    message = comment.message

    if comment.append_badge:
        badge = GithubBadge(
            organization=org,
            repository=repo,
            issue=issue,
        )
        # Crucial with newlines. See: https://github.com/polarsource/polar/issues/868
        message += "\n\n"
        message += badge.badge_markdown("")

    await github_issue_service.add_comment_as_user(
        session,
        org,
        repo,
        issue,
        auth.user,
        message,
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/badge_with_message",
    response_model=IssueSchema,
    tags=[Tags.INTERNAL],
)
async def badge_with_message(
    id: UUID,
    badge_message: IssueUpdateBadgeMessage,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, issue):
        raise Unauthorized()

    org = await organization_service.get(session, issue.organization_id)
    if not org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.set_issue_badge_custom_message(
        session, issue, badge_message.message
    )

    await github_issue_service.embed_badge(
        session,
        organization=org,
        repository=repo,
        issue=issue,
        triggered_from_label=True,
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)
