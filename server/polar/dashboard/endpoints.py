from typing import Any, Dict, List, Sequence, Set, Tuple, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query

from polar.dashboard.schemas import (
    Entry,
    IssueListResponse,
    IssueListType,
    IssueRelationship,
    IssueSortBy,
    IssueStatus,
    Relationship,
    RelationshipData,
)
from polar.enums import Platforms
from polar.issue.schemas import IssueRead, IssueReferenceRead
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.issue_reference import ReferenceType
from polar.models.repository import Repository
from polar.models.user import User
from polar.organization.schemas import OrganizationRead
from polar.repository.schemas import RepositoryRead
from polar.issue.service import issue
from polar.pledge.schemas import PledgeRead
from polar.repository.service import repository
from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session, sql

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
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:
    return await dashboard(
        session=session,
        issue_list_type=issue_list_type,
        status=status,
        q=q,
        sort=sort,
        in_repos=[],
        for_user=auth.user,
        only_pledged=only_pledged,
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
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:
    repositories: Sequence[Repository] = []

    # if repo name is set, use that repository
    if repo_name:
        repo = await repository.get_by(
            session, organization_id=auth.organization.id, name=repo_name
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
        repositories = await repository.list_by_organization(
            session,
            organization_id=auth.organization.id,
        )

    if not repositories:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # If the authenticated user is viewing the org dashboard for their own "org",
    # also show pledges made by their user.
    show_pledges_for_user: User | None = None
    if auth.user.username == org_name:
        show_pledges_for_user = auth.user

    return await dashboard(
        session=session,
        in_repos=repositories,
        issue_list_type=issue_list_type,
        status=status,
        q=q,
        sort=sort,
        for_org=auth.organization,
        for_user=show_pledges_for_user,
        only_pledged=only_pledged,
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
    in_repos: Sequence[Repository] = [],
    issue_list_type: IssueListType = IssueListType.issues,
    status: Union[List[IssueStatus], None] = None,
    q: Union[str, None] = None,
    sort: Union[IssueSortBy, None] = None,
    for_org: Organization | None = None,
    for_user: User | None = None,
    only_pledged: bool = False,
) -> IssueListResponse:
    include_open = False
    if status:
        include_open = (
            IssueStatus.backlog in status
            or IssueStatus.building in status
            or IssueStatus.pull_request in status
        )

    include_closed = False
    if status:
        include_closed = IssueStatus.completed in status

    # Default sorting
    if not sort:
        sort = default_sort(issue_list_type, q)

    #
    # Select top level issues
    #
    issues = await issue.list_by_repository_type_and_status(
        session,
        [r.id for r in in_repos],
        issue_list_type=issue_list_type,
        text=q,
        include_open=include_open,
        include_closed=include_closed,
        sort_by_relevance=sort == IssueSortBy.relevance,
        sort_by_newest=sort == IssueSortBy.newest,
        pledged_by_org=for_org.id if for_org and IssueListType.dependencies else None,
        pledged_by_user=for_user.id
        if for_user and IssueListType.dependencies
        else None,
        have_pledge=True if only_pledged else None,
        load_references=True,
        load_pledges=True,
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
                sql.select(Repository).where(
                    Repository.id.in_(list(set([i.repository_id for i in issues])))
                )
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
            attributes=OrganizationRead.from_orm(
                [o for o in issue_organizations if o.id == i.organization_id][0]
            ),
        )

        # add repos to included
        included[str(i.repository_id)] = Entry(
            id=i.repository_id,
            type="repository",
            attributes=RepositoryRead.from_orm(
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

    # add pledges to included
    for i in issues:
        for pled in i.pledges:
            # for pled in pledges:
            included[str(pled.id)] = Entry(
                id=pled.id, type="pledge", attributes=PledgeRead.from_db(pled)
            )

            # inject relationships
            pledge_relationship = issue_relationship(pled.issue_id, "pledges", [])
            if isinstance(pledge_relationship.data, list):  # it always is
                pledge_relationship.data.append(
                    RelationshipData(type="pledge", id=pled.id)
                )

    issues_with_prs: Set[UUID] = set()

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

            if (
                ref.reference_type == ReferenceType.PULL_REQUEST
                or ref.reference_type == ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST
            ):
                issues_with_prs.add(i.id)

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
                attributes=OrganizationRead.from_orm(
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
                attributes=RepositoryRead.from_orm(
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

    #
    # Filtering
    #

    # filter issues to only include issues with any of the expected statuses
    if status:
        issues = [i for i in issues if issue_progress(i, issues_with_prs) in status]

    #
    # Sorting
    #

    if sort == IssueSortBy.pledged_amount_desc:
        # calculate pledge sum
        sum_by_issue: dict[UUID, int] = dict()
        for i in issues:
            sum_by_issue[i.id] = pledge_sum(i)

        # issues is a sequence and can't be sorted on, quickly convert to a list
        issues_list = [i for i in issues]
        issues_list.sort(key=lambda i: sum_by_issue[i.id], reverse=True)
        issues = issues_list

    if sort == IssueSortBy.dependencies_default:
        issues_list = [i for i in issues]
        issues_list.sort(
            key=lambda e: sort_dependencies_default(
                e, for_org, for_user, issues_with_prs
            ),
            reverse=True,
        )
        issues = issues_list

    if sort == IssueSortBy.issues_default:
        issues_list = [i for i in issues]
        issues_list.sort(
            key=lambda e: sort_issues_default(e),
            reverse=True,
        )
        issues = issues_list

    return IssueListResponse(
        data=[
            Entry(
                id=i.id,
                type="issue",
                attributes=IssueRead.from_orm(i),
                relationships=issue_relationships.get(i.id, None),
            )
            for i in issues
        ],
        included=list(included.values()),
    )


def issue_progress(issue: Issue, issues_with_prs: set[UUID]) -> IssueStatus:
    if issue.issue_closed_at:
        return IssueStatus.completed
    if issue.id in issues_with_prs:
        return IssueStatus.pull_request
    return IssueStatus.backlog


def status_sort_prio(status: IssueStatus) -> int:
    return {
        IssueStatus.backlog: 0,
        IssueStatus.building: 1,
        IssueStatus.pull_request: 2,
        IssueStatus.completed: 3,
    }.get(status, 0)


def pledge_sum(issue: Issue) -> int:
    return sum(p.amount for p in issue.pledges)


def sort_ts(i: Issue) -> int:
    if i.issue_modified_at:
        return int(i.issue_modified_at.timestamp())
    return int(i.issue_created_at.timestamp())


def sort_dependencies_default(
    i: Issue,
    for_org: Organization | None,
    for_user: User | None,
    issues_with_prs: set[UUID],
) -> Tuple[int, int, int]:
    self_pledged_amount = sum(
        [
            p.amount
            for p in i.pledges
            if (
                (for_org and p.by_organization_id == for_org.id)
                or (for_user and p.by_user_id == for_user.id)
            )
            and p.issue_id == i.id
        ]
    )

    progress = status_sort_prio(issue_progress(i, issues_with_prs))

    return (self_pledged_amount, progress, sort_ts(i))


def sort_issues_default(
    i: Issue,
) -> Tuple[int, int, int]:
    total_pledged_amount = sum([p.amount for p in i.pledges])
    thumbs_up_count = i.reactions.get("plus_one", 0) if i.reactions else 0
    return (total_pledged_amount, thumbs_up_count, sort_ts(i))
