from typing import List, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.extension.schemas import IssueExtensionRead
from polar.models import Issue
from polar.enums import Platforms
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead, State
from polar.postgres import AsyncSession, get_db_session
from polar.exceptions import ResourceNotFound

from polar.issue.service import issue as issue_service
from polar.pledge.service import pledge as pledge_service

router = APIRouter(tags=["extension"])

@router.get(
    "/extension/{platform}/{org_name}/{repo_name}/issues",
    response_model=list[IssueExtensionRead]
)
async def list_issues_for_extension(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    numbers: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[IssueExtensionRead]:
    issue_numbers = [int(number) for number in numbers.split(",")]
    issues = await issue_service.list_by_repository_and_numbers(
        session=session, repository_id=auth.repository.id, numbers=issue_numbers)
    pledges = await pledge_service.get_by_issue_ids(
        session=session, issue_ids=[issue.id for issue in issues])

    pledges_by_issue_id: dict[UUID, list[Pledge]] = {}
    for pledge in pledges:
        if pledge.issue_id not in pledges_by_issue_id:
            pledges_by_issue_id[pledge.issue_id] = []
        pledges_by_issue_id[pledge.issue_id].append(pledge)
    
    ret = []
    for issue in issues:
        if pledges_by_issue_id.get(issue.id):
            issue_extension = IssueExtensionRead(
                number=issue.number,
                pledges=[PledgeRead.from_db(p) for p in pledges_by_issue_id[issue.id]],
                references=[]
            )
            ret.append(issue_extension)

    return ret
