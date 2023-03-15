from typing import Any, Dict, List, Union
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
from polar.organization.schemas import OrganizationRead
from polar.repository.schemas import RepositoryRead
from polar.issue.service import issue
from polar.reward.schemas import RewardRead
from polar.reward.service import reward
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

    # get rewards
    issue_ids = [i.id for i in issues]
    rewards = await reward.get_by_issue_ids(session, issue_ids)

    # start building issue relationships with rewards
    issue_relationships: Dict[UUID, List[Relationship]] = {}

    # add rewards to included
    for r in rewards:
        included.append(
            Entry(id=r.id, type="reward", attributes=RewardRead.from_orm(r))
        )
        # inject relationships
        rel = Relationship(data=RelationshipData(type="reward", id=r.id))
        if r.issue_id not in issue_relationships:
            issue_relationships[r.issue_id] = []
        issue_relationships[r.issue_id].append(rel)

    # Add repository and organization relationships to issues
    for i in issues:
        if i.id not in issue_relationships:
            issue_relationships[i.id] = []
        orgRel = Relationship(
            data=RelationshipData(type="organization", id=auth.organization.id)
        )
        issue_relationships[i.id].append(orgRel)

        repoRel = Relationship(
            data=RelationshipData(type="repository", id=auth.repository.id)
        )
        issue_relationships[i.id].append(repoRel)

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
