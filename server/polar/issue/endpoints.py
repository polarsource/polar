from typing import Sequence

from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.models import Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from .schemas import IssueRead
from .service import issue

router = APIRouter()


@router.get("/{platform}/{org_name}/{repo_name}", response_model=list[IssueRead])
async def get_repository_issues(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[Issue]:
    issues = await issue.list_by_repository(
        session=session, repository_id=auth.repository.id
    )
    return issues
