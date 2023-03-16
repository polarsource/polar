from typing import Any, Dict, List, Set, Union
from uuid import UUID
from fastapi import APIRouter, Depends, Query

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
from polar.organization.schemas import OrganizationRead
from polar.pull_request.schemas import PullRequestRead
from polar.repository.schemas import RepositoryRead
from polar.issue.service import issue
from polar.pledge.schemas import PledgeRead
from polar.pledge.service import pledge
from polar.pull_request.service import pull_request
from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session

router = APIRouter(tags=["dashboard"])


@router.get(
    "/{platform}/{org_name}/{repo_name}/dashboard",
    response_model=IssueListResponse,
)
async def get_dashboard(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
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

    # get issues
    issues = await issue.list_by_repository_and_status(
        session,
        auth.repository.id,
        text=q,
        include_open=include_open,
        include_closed=include_closed,
    )

    # add org and repo to included
    included: List[Entry[Any]] = [
        Entry(
            id=auth.organization.id,
            type="organization",
            attributes=OrganizationRead.from_orm(auth.organization),
        ),
        Entry(
            id=auth.repository.id,
            type="repository",
            attributes=RepositoryRead.from_orm(auth.repository),
        ),
    ]

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

        repoRel = Relationship(
            data=RelationshipData(type="repository", id=auth.repository.id)
        )
        issue_relationships[i.id].append(repoRel)

    issues_with_prs: Set[UUID] = set()

    # get linked pull requests
    for i in issues:
        prs = await pull_request.list_by_repository_for_issue(
            session, auth.repository.id, i.number
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
