from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException

from polar.actions import repository
from polar.api.deps import current_active_user, get_db_session
from polar.auth.repository import repository_auth
from polar.models import Issue, User
from polar.organization.service import organization
from polar.platforms import Platforms
from polar.postgres import AsyncSession

from .schemas import IssueRead
from .service import issue

router = APIRouter()


@router.get("/{platform}/{organization_name}/{name}", response_model=list[IssueRead])
async def get_repository_issues(
    platform: Platforms,
    organization_name: str,
    name: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Issue]:

    org = await organization.get_by(
        session=session,
        platform=platform,
        name=organization_name,
    )

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    repo = await repository.get_by(
        session=session,
        platform=platform,
        organization_id=org.id,
        name=name,
    )

    # Validate that the user has access to the repository
    if not await repository_auth.can_write(session, user, repo):
        raise HTTPException(
            status_code=403,
            detail="User does not have access to this repository",
        )

    issues = await issue.list_by_repository(session=session, repository_id=repo.id)

    return issues
