
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from polar.dashboard.schemas import Entry, IssueListResponse
from polar.enums import Platforms
from polar.issue.schemas import IssueRead
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization
from polar.repository.schemas import RepositoryRead
from polar.repository.service import repository
from polar.issue.service import issue
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
    q: str  | None = None,
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
    repo = await repository.get_by(session, organization_id=org.id, name=repository_name)
    if not repo:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )
    
    # get issues
    issues = await issue.list_by_repository(session,repo.id)
    if not issues:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    included: List[Entry[Any]] = [
        Entry(id=org.id, type="organization", attributes=OrganizationRead.from_orm(org)),
        Entry(id=repo.id, type="repository", attributes=RepositoryRead.from_orm(repo)),
    ]

    return IssueListResponse(
         data=[
             Entry(id=item.id, type="issue", attributes=IssueRead.from_orm(item))
             for item in issues
         ],
        included=included,
    )
