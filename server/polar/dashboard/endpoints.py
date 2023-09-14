from typing import Any, Dict, List, Sequence, Union
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import joinedload

from polar.auth.dependencies import Auth
from polar.dashboard.schemas import (
    Entry,
    IssueDashboardRead,
    IssueListResponse,
    IssueListType,
    IssueRelationship,
    IssueSortBy,
    IssueStatus,
    PaginationResponse,
    Relationship,
    RelationshipData,
)
from polar.enums import Platforms
from polar.issue.schemas import IssueRead, IssueReferenceRead
from polar.issue.service import issue
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization.schemas import Organization as OrganizationSchema
from polar.pledge.schemas import PledgeRead, PledgeState
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session, sql
from polar.repository.schemas import Repository as RepositorySchema
from polar.repository.service import repository
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

router = APIRouter(tags=["dashboard"])


@router.get(
    "/dashboard/personal",
    response_model=IssueListResponse,
)
async def get_personal_dashboard(
    issue_list_type: IssueListType = IssueListType.issues,
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    sort: Union[IssueSortBy, None] = Query(default=None),
    only_pledged: bool = Query(default=False),
    only_badged: bool = Query(default=False),
    page: int = Query(default=1),
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:
    return await dashboard(
        session=session,
        auth=auth,
        issue_list_type=issue_list_type,
        status=status,
        q=q,
        sort=sort,
        in_repos=[],
        page=page,
        for_user=auth.user,
        only_pledged=only_pledged,
        only_badged=only_badged,
    )


@router.get(
    "/dashboard/{platform}/{org_name}",
    response_model=IssueListResponse,
)
async def get_dashboard(
    platform: Platforms,
    org_name: str,
    repo_name: Union[str, None] = Query(default=None),
    issue_list_type: IssueListType = IssueListType.issues,
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    sort: Union[IssueSortBy, None] = Query(default=None),
    only_pledged: bool = Query(default=False),
    only_badged: bool = Query(default=False),
    page: int = Query(default=1),
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:
    repositories: Sequence[Repository] = []

    # if repo name is set, use that repository
    if repo_name:
        repo = await repository.get_by_org_and_name(
            session,
            organization_id=auth.organization.id,
            name=repo_name,
            load_organization=True,
        )
        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )
        repositories = [repo]
    else:
        # if no repo name is set, use all repositories in the organization
        # TODO: Once we support it: Only show repositories that the user can see on
        # GitHub
        repositories = await repository.list_by(
            session,
            org_ids=[auth.organization.id],
            load_organization=True,
        )

    if not repositories:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # If the authenticated user is viewing the org dashboard for their own "org",
    # also show pledges made by their user.
    show_pledges_for_user: User | None = None
    if auth.user and auth.user.username == org_name:
        show_pledges_for_user = auth.user

    return await dashboard(
        session=session,
        auth=auth,
        in_repos=repositories,
        issue_list_type=issue_list_type,
        status=status,
        q=q,
        sort=sort,
        for_org=auth.organization,
        for_user=show_pledges_for_user,
        only_pledged=only_pledged,
        only_badged=only_badged,
        page=page,
    )


def default_sort(
    issue_list_type: IssueListType,
    q: Union[str, None] = None,
) -> IssueSortBy:
    if q:
        return IssueSortBy.relevance

    if issue_list_type == IssueListType.issues:
        return IssueSortBy.issues_default

    if issue_list_type == IssueListType.dependencies:
        return IssueSortBy.dependencies_default

    return IssueSortBy.newest


async def dashboard(
    session: AsyncSession,
    auth: Auth,
    in_repos: Sequence[Repository] = [],
    issue_list_type: IssueListType = IssueListType.issues,
    status: Union[List[IssueStatus], None] = None,
    q: Union[str, None] = None,
    sort: Union[IssueSortBy, None] = None,
    for_org: Organization | None = None,
    for_user: User | None = None,
    only_pledged: bool = False,
    only_badged: bool = False,
    page: int = 1,
) -> IssueListResponse:
    # Default sorting
    if not sort:
        sort = default_sort(issue_list_type, q)

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
        issue_list_type=issue_list_type,
        text=q,
        pledged_by_org=for_org.id if for_org and IssueListType.dependencies else None,
        pledged_by_user=for_user.id
        if for_user and IssueListType.dependencies
        else None,
        have_pledge=True if only_pledged else None,
        have_polar_badge=True if only_badged else None,
        load_references=True,
        load_pledges=True,
        load_repository=True,
        include_statuses=status,
        sort_by=sort,
        limit=limit,
        offset=offset,
    )

    issue_organizations = list(
        (
            await session.execute(
                sql.select(Organization).where(
                    Organization.id.in_(list(set([i.organization_id for i in issues])))
                )
            )
        )
        .scalars()
        .unique()
        .all()
    )
    if for_org:
        issue_organizations.append(for_org)

    issue_repositories = list(
        (
            await session.execute(
                sql.select(Repository)
                .where(Repository.id.in_(list(set([i.repository_id for i in issues]))))
                .options(joinedload(Repository.organization))
            )
        )
        .scalars()
        .unique()
        .all()
    ) + list(in_repos)

    included: dict[str, Entry[Any]] = {}

    # start building issue relationships with pledges
    issue_relationships: Dict[UUID, IssueRelationship] = {}

    def issue_relationship(
        issue_id: UUID, key: str, default: RelationshipData | List[RelationshipData]
    ) -> Relationship:
        return issue_relationships.setdefault(issue_id, IssueRelationship()).setdefault(
            key, Relationship(data=default)
        )

    # Add repository and organization relationships to issues, and to included data
    for i in issues:
        # add org to included
        included[str(i.organization_id)] = Entry(
            id=i.organization_id,
            type="organization",
            attributes=OrganizationSchema.from_db(
                [o for o in issue_organizations if o.id == i.organization_id][0]
            ),
        )

        # add repos to included
        included[str(i.repository_id)] = Entry(
            id=i.repository_id,
            type="repository",
            attributes=RepositorySchema.from_db(
                [r for r in issue_repositories if r.id == i.repository_id][0]
            ),
        )

        org_data = RelationshipData(type="organization", id=i.organization_id)
        issue_relationship(i.id, "organization", org_data)

        if i.repository_id:
            issue_relationship(
                i.id,
                "repository",
                RelationshipData(type="repository", id=i.repository_id),
            )

    pledge_statuses = list(
        set(PledgeState.active_states()) | set([PledgeState.disputed])
    )

    # load user memberships
    user_memberships: Sequence[UserOrganization] = []
    if auth.user:
        user_memberships = await user_organization_service.list_by_user_id(
            session,
            auth.user.id,
        )

    # add pledges to included
    for i in issues:
        for pled in i.pledges:
            # Filter out invalid pledges
            if pled.state not in pledge_statuses:
                continue

            pledge_read = PledgeRead.from_db(pled)

            # Add user-specific metadata

            user_can_admin = (for_user and pled.by_user_id == for_user.id) or (
                for_org and pled.by_organization_id == for_org.id
            )

            if user_can_admin:
                pledge_read.authed_user_can_admin = True

            if auth.user:
                pledge_read.authed_user_can_admin_sender = (
                    pledge_service.user_can_admin_sender_pledge(
                        auth.user, pled, user_memberships
                    )
                )
                pledge_read.authed_user_can_admin_received = (
                    pledge_service.user_can_admin_received_pledge(
                        pled, user_memberships
                    )
                )

            # for pled in pledges:
            included[str(pled.id)] = Entry(
                id=pled.id, type="pledge", attributes=pledge_read
            )

            # inject relationships
            pledge_relationship = issue_relationship(pled.issue_id, "pledges", [])
            if isinstance(pledge_relationship.data, list):  # it always is
                pledge_relationship.data.append(
                    RelationshipData(type="pledge", id=pled.id)
                )

    # get linked pull requests
    for i in issues:
        refs = i.references
        for ref in refs:
            ref_entry: Entry[IssueReferenceRead] = Entry(
                id=ref.external_id,
                type="reference",
                attributes=IssueReferenceRead.from_model(ref),
            )
            included[ref.external_id] = ref_entry

            ir = issue_relationship(ref.issue_id, "references", [])
            if isinstance(ir.data, list):  # it always is
                ir.data.append(RelationshipData(type="reference", id=ref.external_id))

    # get dependents
    if issue_list_type == IssueListType.dependencies:
        issue_deps = await issue.list_issue_dependencies_for_repositories(
            session, in_repos
        )

        for dep in issue_deps:
            dependent_issue = dep.dependent_issue

            # add org to included
            included[str(dependent_issue.organization_id)] = Entry(
                id=dependent_issue.organization_id,
                type="organization",
                attributes=OrganizationSchema.from_db(
                    [
                        o
                        for o in issue_organizations
                        if o.id == dependent_issue.organization_id
                    ][0]
                ),
            )

            # add repos to included
            included[str(dependent_issue.repository_id)] = Entry(
                id=dependent_issue.repository_id,
                type="repository",
                attributes=RepositorySchema.from_db(
                    [
                        r
                        for r in issue_repositories
                        if r.id == dependent_issue.repository_id
                    ][0]
                ),
            )

            # and to relationships
            org_data = RelationshipData(
                type="organization", id=dependent_issue.organization_id
            )
            issue_relationship(dependent_issue.id, "organization", org_data)

            issue_relationship(
                dependent_issue.id,
                "repository",
                RelationshipData(type="repository", id=dependent_issue.repository_id),
            )

            # add dependent issue to included
            dep_entry: Entry[IssueRead] = Entry(
                id=dependent_issue.id,
                type="issue",
                attributes=IssueRead.from_orm(dependent_issue),
                relationships=issue_relationships.get(dependent_issue.id, {}),
            )
            included[str(dependent_issue.id)] = dep_entry

            ir = issue_relationship(dep.dependency_issue.id, "dependents", [])
            if isinstance(ir.data, list):  # it always is
                ir.data.append(RelationshipData(type="issue", id=dependent_issue.id))

    next_page = page + 1 if total_issue_count > page * limit else None

    data: List[Entry[IssueDashboardRead]] = [
        Entry[IssueDashboardRead](
            id=i.id,
            type="issue",
            attributes=IssueDashboardRead.from_db(i),
            relationships=issue_relationships.get(i.id, None),
        )
        for i in issues
    ]

    return IssueListResponse(
        # FIXME: mypy complains that List[Entry[IssueDashboardRead]] is not a
        # List[Entry[DataT]]. Why?
        data=data,  # type: ignore
        included=list(included.values()),
        pagination=PaginationResponse(
            total_count=total_issue_count,
            page=page,
            next_page=next_page,
        ),
    )
