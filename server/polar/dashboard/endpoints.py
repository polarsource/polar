from typing import Any, Dict, List, Sequence, Set, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query

from polar.dashboard.schemas import (
    Entry,
    IssueListResponse,
    IssueStatus,
    Relationship,
    RelationshipData,
)
from polar.enums import Platforms
from polar.issue.schemas import IssueRead
from polar.models.issue import Issue
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationRead
from polar.pull_request.schemas import PullRequestRead
from polar.repository.schemas import RepositoryRead
from polar.issue.service import issue
from polar.pledge.schemas import PledgeRead
from polar.pledge.service import pledge
from polar.pull_request.service import pull_request
from polar.repository.service import repository
from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session

router = APIRouter(tags=["dashboard"])


@router.get(
    "/{platform}/{org_name}/dashboard",
    response_model=IssueListResponse,
)
async def get_dashboard(
    platform: Platforms,
    org_name: str,
    repo_name: Union[str, None] = Query(default=None),
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
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
        # TODO: Once we support it: Only show repositories that the user can see on GitHub
        repositories = await repository.list_by_organization(
            session,
            organization_id=auth.organization.id,
        )

    if not repositories:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # get issues
    issues = await issue.list_by_repository_and_status(
        session,
        [r.id for r in repositories],
        text=q,
        include_open=include_open,
        include_closed=include_closed,
    )

    # add org to included
    included: List[Entry[Any]] = [
        Entry(
            id=auth.organization.id,
            type="organization",
            attributes=OrganizationRead.from_orm(auth.organization),
        ),
    ]

    # add repos to included
    for r in repositories:
        included.append(
            Entry(
                id=r.id,
                type="repository",
                attributes=RepositoryRead.from_orm(r),
            )
        )

    # get pledges
    issue_ids = [i.id for i in issues]
    pledges = await pledge.get_by_issue_ids(session, issue_ids)

    # start building issue relationships with pledges
    issue_relationships: Dict[UUID, List[Relationship]] = {}
    for i in issues:
        issue_relationships[i.id] = []

    # add pledges to included
    for r in pledges:
        included.append(
            Entry(id=r.id, type="pledge", attributes=PledgeRead.from_orm(r))
        )
        # inject relationships
        rel = Relationship(data=RelationshipData(type="pledge", id=r.id))
        issue_relationships[r.issue_id].append(rel)

    # Add repository and organization relationships to issues
    for i in issues:
        orgRel = Relationship(
            data=RelationshipData(type="organization", id=auth.organization.id)
        )
        issue_relationships[i.id].append(orgRel)

        if i.repository_id:
            repoRel = Relationship(
                data=RelationshipData(type="repository", id=i.repository_id)
            )
            issue_relationships[i.id].append(repoRel)

    issues_with_prs: Set[UUID] = set()

    # get linked pull requests
    for i in issues:
        if not i.repository_id:
            continue

        prs = await pull_request.list_by_repository_for_issue(
            session, i.repository_id, i.number
        )
        # Add to included and to relationships
        for pr in prs:
            entry: Entry[PullRequestRead] = Entry(
                id=pr.id,
                type="pull_request",
                attributes=PullRequestRead.from_orm(pr),
            )
            rel = Relationship(data=RelationshipData(type="pull_request", id=pr.id))
            included.append(entry)
            issue_relationships[i.id].append(rel)

        if prs:
            issues_with_prs.add(i.id)

    def issue_progress(issue: Issue) -> IssueStatus:
        if issue.issue_closed_at:
            return IssueStatus.completed
        if issue.id in issues_with_prs:
            return IssueStatus.pull_request
        return IssueStatus.backlog

    # filter issues to only include issues with any of the expected statuses
    if status:
        issues = [i for i in issues if issue_progress(i) in status]

    # TODO: only include related objects for issues in the response

    return IssueListResponse(
        data=[
            Entry(
                id=i.id,
                type="issue",
                attributes=IssueRead.from_orm(i),
                relationships=issue_relationships.get(i.id, []),
            )
            for i in issues
        ],
        included=included,
    )
