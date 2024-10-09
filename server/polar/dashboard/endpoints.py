from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, Query

from polar.auth.dependencies import WebUser
from polar.auth.models import AuthSubject
from polar.authz.service import AccessType, Authz
from polar.dashboard.schemas import (
    Entry,
    IssueListResponse,
    IssueSortBy,
    PaginationResponse,
)
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.funding.schemas import PledgesTypeSummaries
from polar.issue.schemas import Issue as IssueSchema
from polar.issue.service import issue
from polar.models.organization import Organization
from polar.models.pledge import PledgeState
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.organization.schemas import OrganizationID
from polar.organization.service import organization as organization_service
from polar.pledge.endpoints import to_schema as pledge_to_schema
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.dependencies import OptionalRepositoryNameQuery
from polar.repository.service import repository
from polar.reward.endpoints import to_resource
from polar.reward.schemas import Reward
from polar.reward.service import reward_service
from polar.routing import APIRouter
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

router = APIRouter(tags=["dashboard"], include_in_schema=IN_DEVELOPMENT_ONLY)


@router.get(
    "/dashboard/personal",
    response_model=IssueListResponse,
)
async def get_personal_dashboard(
    auth_subject: WebUser,
    q: str | None = Query(default=None),
    sort: IssueSortBy | None = Query(default=None),
    only_pledged: bool = Query(default=False),
    only_badged: bool = Query(default=False),
    show_closed: bool = Query(default=False),
    page: int = Query(default=1),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueListResponse:
    return await dashboard(
        session=session,
        auth_subject=auth_subject,
        authz=authz,
        q=q,
        sort=sort,
        in_repos=[],
        page=page,
        for_user=auth_subject.subject,
        only_pledged=only_pledged,
        only_badged=only_badged,
        show_closed=show_closed,
    )


@router.get(
    "/dashboard/organization/{id}",
    response_model=IssueListResponse,
)
async def get_dashboard(
    auth_subject: WebUser,
    id: OrganizationID,
    repository_name: OptionalRepositoryNameQuery = None,
    q: str | None = Query(default=None),
    sort: IssueSortBy | None = Query(default=None),
    only_pledged: bool = Query(default=False),
    only_badged: bool = Query(default=False),
    show_closed: bool = Query(default=False),
    page: int = Query(default=1),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> IssueListResponse:
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()

    # only if user is a member of this org
    if not await user_organization_service.get_by_user_and_org(
        session, auth_subject.subject.id, organization_id=org.id
    ):
        raise Unauthorized()

    repositories: Sequence[Repository] = []

    # if repo name is set, use that repository
    if repository_name:
        repo = await repository.get_by_org_and_name(
            session,
            organization_id=org.id,
            name=repository_name,
            load_organization=True,
        )
        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )
        repositories = [repo]
    else:
        repositories = await repository.list_by(
            session,
            organization_id=[org.id],
            load_organization=True,
        )

    # Limit to repositories that the authed subject can read
    repositories = [
        r
        for r in repositories
        if await authz.can(auth_subject.subject, AccessType.read, r)
    ]

    if not repositories:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    return await dashboard(
        session=session,
        auth_subject=auth_subject,
        authz=authz,
        in_repos=repositories,
        q=q,
        sort=sort,
        for_org=org,
        only_pledged=only_pledged,
        only_badged=only_badged,
        show_closed=show_closed,
        page=page,
    )


async def dashboard(
    session: AsyncSession,
    auth_subject: AuthSubject[User],
    authz: Authz,
    in_repos: Sequence[Repository] = [],
    q: str | None = None,
    sort: IssueSortBy | None = None,
    for_org: Organization | None = None,
    for_user: User | None = None,
    only_pledged: bool = False,
    only_badged: bool = False,
    show_closed: bool = False,
    page: int = 1,
) -> IssueListResponse:
    user = auth_subject.subject
    # Default sorting
    if not sort:
        sort = IssueSortBy.issues_default

    # Pagination.
    # Page 1 is the first page
    limit = 100
    offset = (page - 1) * limit

    #
    # Select top level issues
    #
    (issues, total_issue_count) = await issue.list_by_repository_type_and_status(
        session,
        [r.id for r in in_repos],
        text=q,
        pledged_by_org=None,
        pledged_by_user=for_user.id if for_user else None,
        have_pledge=True if only_pledged else None,
        have_polar_badge=True if only_badged else None,
        load_pledges=True,
        load_repository=True,
        show_closed=show_closed,
        show_closed_if_needs_action=True,
        sort_by=sort,
        limit=limit,
        offset=offset,
    )

    pledge_statuses = list(
        set(PledgeState.active_states()) | set([PledgeState.disputed])
    )

    # load user memberships
    user_memberships: Sequence[UserOrganization] = []
    user_memberships = await user_organization_service.list_by_user_id(session, user.id)

    # add pledges to included
    issue_pledges: dict[UUID, list[PledgeSchema]] = {}
    for i in issues:
        for pled in i.pledges:
            # Filter out invalid pledges
            if pled.state not in pledge_statuses:
                continue

            pledge_schema = await pledge_to_schema(session, user, pled)

            # Add user-specific metadata
            pledge_schema.authed_can_admin_sender = (
                pledge_service.user_can_admin_sender_pledge(
                    user, pled, user_memberships
                )
            )

            external_organization = await external_organization_service.get_linked(
                session, i.organization_id
            )
            pledge_schema.authed_can_admin_received = (
                external_organization is not None
                and any(
                    m.organization_id == external_organization.organization_id
                    for m in user_memberships
                )
            )

            irefs = issue_pledges.get(i.id, [])
            irefs.append(pledge_schema)
            issue_pledges[i.id] = irefs

    # get pledge summary (public data, vs pledges who are dependent on who you are)
    pledge_summaries = await pledge_service.issues_pledge_type_summary(
        session,
        issues=issues,
    )
    issue_pledge_summaries: dict[UUID, PledgesTypeSummaries] = {}
    for issue_id, summary in pledge_summaries.items():
        issue_pledge_summaries[issue_id] = summary

    # get rewards
    issue_rewards: dict[UUID, list[Reward]] = {}
    if for_org:
        rewards = await reward_service.list(session, issue_ids=[i.id for i in issues])
        for pledge, reward, transaction in rewards:
            reward_resource = to_resource(
                pledge,
                reward,
                transaction,
                include_receiver_admin_fields=await authz.can(
                    user, AccessType.write, pledge
                ),
            )

            ir2 = issue_rewards.get(pledge.issue_id, [])
            ir2.append(reward_resource)
            issue_rewards[pledge.issue_id] = ir2

    next_page = page + 1 if total_issue_count > page * limit else None

    data: list[Entry] = [
        Entry(
            id=i.id,
            type="issue",
            attributes=IssueSchema.model_validate(i),
            rewards=issue_rewards.get(i.id, None),
            pledges_summary=issue_pledge_summaries.get(i.id, None),
            pledges=issue_pledges.get(i.id, None),
        )
        for i in issues
    ]

    return IssueListResponse(
        data=data,
        pagination=PaginationResponse(
            total_count=total_issue_count,
            page=page,
            next_page=next_page,
        ),
    )


# An annoying hack to force the OpenAPI schema to include type definitions for
# PledgesTypeSummaries
@router.get(
    "/dashboard/dummy_do_not_use",
    response_model=PledgesTypeSummaries,
)
async def dummy_do_not_use() -> PledgesTypeSummaries:
    raise ResourceNotFound()
