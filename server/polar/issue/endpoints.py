import builtins
from uuid import UUID

from fastapi import Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from polar.auth.dependencies import WebUser, WebUserOrAnonymous
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.integrations.github.badge import GithubBadge
from polar.integrations.github.client import Forbidden, get_polar_client
from polar.integrations.github.service.issue import github_issue as github_issue_service
from polar.integrations.github.service.url import github_url
from polar.issue.body import IssueBodyRenderer, get_issue_body_renderer
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.locker import Locker, get_locker
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.organization.schemas import OrganizationID
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session, get_db_sessionmaker
from polar.repository.service import repository as repository_service
from polar.routing import APIRouter
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from . import auth, sorting
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
    "/issues/",
    response_model=ListResource[IssueSchema],
    summary="List Issues",
    status_code=200,
    responses={404: {}},
)
async def list(
    auth_subject: auth.IssuesReadOrAnonymous,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    platform: MultipleQueryFilter[Platforms] | None = Query(
        None, title="Platform Filter", description="Filter by platform."
    ),
    external_organization_name: MultipleQueryFilter[str] | None = Query(
        None,
        title="ExternalOrganizationName Filter",
        description="Filter by external organization name.",
    ),
    repository_name: MultipleQueryFilter[str] | None = Query(
        None, title="RepositoryName Filter", description="Filter by repository name."
    ),
    number: MultipleQueryFilter[int] | None = Query(
        None, title="IssueNumber Filter", description="Filter by issue number."
    ),
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[IssueSchema]:
    """List issues."""
    results, count = await issue_service.list(
        session,
        auth_subject,
        platform=platform,
        external_organization_name=external_organization_name,
        repository_name=repository_name,
        number=number,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [IssueSchema.from_db(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/issues/lookup",
    response_model=IssueSchema,
)
async def lookup(
    auth_subject: WebUserOrAnonymous,
    external_url: str | None = Query(
        default=None,
        description="URL to issue on external source",
        examples=["https://github.com/polarsource/polar/issues/897"],
    ),
    authz: Authz = Depends(Authz.authz),
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

        if not await authz.can(auth_subject.subject, AccessType.read, issue):
            raise Unauthorized()

        return IssueSchema.from_db(issue)

    raise ResourceNotFound("Issue not found")


@router.get(
    "/issues/{id}/body",
)
async def get_body(
    id: UUID,
    auth_subject: WebUserOrAnonymous,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
    issue_body_renderer: IssueBodyRenderer = Depends(get_issue_body_renderer),
) -> HTMLResponse:
    issue = await issue_service.get_loaded(session, id)
    if issue is None:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.read, issue):
        raise Unauthorized()

    content = await issue_body_renderer.render(
        issue, issue.repository, issue.repository.organization
    )

    return HTMLResponse(content=content)


@router.get(
    "/issues/for_you",
    response_model=ListResource[IssueSchema],
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def for_you(
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    sessionmaker: AsyncSessionMaker = Depends(get_db_sessionmaker),
    locker: Locker = Depends(get_locker),
) -> ListResource[IssueSchema]:
    issues = await github_issue_service.list_issues_from_starred(
        session, locker, sessionmaker, auth_subject.subject
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
    def spread(items: builtins.list[IssueSchema]) -> builtins.list[IssueSchema]:
        penalties: dict[str, int] = {}
        res: builtins.list[IssueSchema] = []

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
    description="Get issue",
    summary="Get issue",
)
async def get(
    id: UUID,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth_subject.subject, AccessType.read, issue):
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}",
    response_model=IssueSchema,
    description="Update issue. Requires authentication.",
    summary="Update issue.",
)
async def update(
    id: UUID,
    update: UpdateIssue,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)

    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
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
        session.add(issue)

    return IssueSchema.from_db(issue)


@router.post(
    "/issues/{id}/confirm_solved",
    response_model=IssueSchema,
    description="Mark an issue as confirmed solved, and configure issue reward splits. Enables payouts of pledges. Can only be done once per issue. Requires authentication.",  # noqa: E501
    summary="Mark an issue as confirmed solved.",
)
async def confirm(
    id: UUID,
    body: ConfirmIssue,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get_loaded(session, id)
    if not issue:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
        raise Forbidden()

    external_organization = await external_organization_service.get_linked(
        session, issue.organization_id
    )
    if external_organization is None:
        raise Forbidden()

    if (
        await user_organization_service.get_by_user_and_org(
            session, auth_subject.subject.id, external_organization.safe_organization.id
        )
        is None
    ):
        raise Forbidden()

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
        session, issue_id=issue.id, by_user_id=auth_subject.subject.id
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
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def add_polar_badge(
    id: UUID,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
        raise Unauthorized()

    external_org = await external_organization_service.get_linked(
        session, issue.organization_id
    )
    if not external_org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.add_polar_label(
        session, external_org, repo, issue
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/remove_badge",
    response_model=IssueSchema,
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def remove_polar_badge(
    id: UUID,
    auth_subject: WebUser,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
        raise Unauthorized()

    external_org = await external_organization_service.get_linked(
        session, issue.organization_id
    )
    if not external_org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.remove_polar_label(
        session, external_org, repo, issue
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/comment",
    response_model=IssueSchema,
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def add_issue_comment(
    id: UUID,
    comment: PostIssueComment,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
    locker: Locker = Depends(get_locker),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
        raise Unauthorized()

    external_org = await external_organization_service.get_linked(
        session, issue.organization_id
    )
    if not external_org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    message = comment.message

    if comment.append_badge:
        badge = GithubBadge(
            external_organization=external_org,
            repository=repo,
            issue=issue,
            organization=external_org.safe_organization,
        )
        # Crucial with newlines. See: https://github.com/polarsource/polar/issues/868
        message += "\n\n"
        message += badge.badge_markdown("")

    await github_issue_service.add_comment_as_user(
        session, locker, external_org, repo, issue, auth_subject.subject, message
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)


@router.post(
    "/issues/{id}/badge_with_message",
    response_model=IssueSchema,
    include_in_schema=IN_DEVELOPMENT_ONLY,
)
async def badge_with_message(
    id: UUID,
    badge_message: IssueUpdateBadgeMessage,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueSchema:
    issue = await issue_service.get(session, id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, issue):
        raise Unauthorized()

    external_org = await external_organization_service.get_linked(
        session, issue.organization_id
    )
    if not external_org:
        raise ResourceNotFound()

    repo = await repository_service.get(session, issue.repository_id)
    if not repo:
        raise ResourceNotFound()

    issue = await github_issue_service.set_issue_badge_custom_message(
        session, issue, badge_message.message
    )

    await github_issue_service.embed_badge(
        session,
        external_organization=external_org,
        repository=repo,
        issue=issue,
        organization=external_org.safe_organization,
        triggered_from_label=True,
    )

    # get for return
    issue_ret = await issue_service.get_loaded(session, issue.id)
    if not issue_ret:
        raise ResourceNotFound()

    return IssueSchema.from_db(issue_ret)
