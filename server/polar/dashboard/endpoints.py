from typing import Any, Dict, List, Union
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
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization
from polar.repository.schemas import RepositoryRead
from polar.repository.service import repository
from polar.issue.service import issue
from polar.reward.schemas import RewardRead
from polar.reward.service import reward
from polar.auth.dependencies import current_active_user
from polar.models import User
from polar.postgres import AsyncSession, get_db_session

router = APIRouter()


@router.get(
    "/{platform}/{organization_name}/{repository_name}",
    response_model=IssueListResponse,
)
async def get_dashboard(
    platform: Platforms,
    organization_name: str,
    repository_name: str,
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:

    # find org
    org = await organization.get_by_name(session, platform, organization_name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # find repo
    repo = await repository.get_by(
        session, organization_id=org.id, name=repository_name
    )
    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

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
        repo.id,
        text=q,
        include_open=include_open,
        include_closed=include_closed,
    )

    # add org and repo to included
    included: List[Entry[Any]] = [
        Entry(
            id=org.id, type="organization", attributes=OrganizationRead.from_orm(org)
        ),
        Entry(id=repo.id, type="repository", attributes=RepositoryRead.from_orm(repo)),
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
        rel = Relationship(data=[RelationshipData(type="reward", id=r.id)])
        if r.issue_id not in issue_relationships:
            issue_relationships[r.issue_id] = []
        issue_relationships[r.issue_id].append(rel)

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
