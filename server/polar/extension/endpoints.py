from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.extension.schemas import IssueExtensionRead
from polar.issue.schemas import IssueReferenceRead
from polar.issue.service import issue as issue_service
from polar.kit import utils
from polar.models.issue_reference import IssueReference
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog

router = APIRouter(tags=["extension"])


@router.get(
    "/extension/{platform}/{org_name}/{repo_name}/issues",
    response_model=list[IssueExtensionRead],
)
async def list_issues_for_extension(
    request: Request,
    platform: Platforms,
    org_name: str,
    repo_name: str,
    numbers: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> list[IssueExtensionRead]:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Update when we last saw this user and on which extension version
    version = "unknown"
    auth.user.last_seen_at_extension = utils.utc_now()
    if request.headers.get("x-polar-agent"):
        parts = request.headers["x-polar-agent"].split("/")
        if len(parts) == 2:
            version = parts[1]
            auth.user.last_version_extension = version

    await auth.user.save(session=session)
    posthog.user_event(
        auth.user,
        "Extension GitHub Issues Load",
        {
            "extension_version": version,
            "org": org_name,
            "repo": repo_name,
            "numbers": numbers,
        },
    )

    issue_numbers = [int(number) for number in numbers.split(",")]
    issues = await issue_service.list_by_repository_and_numbers(
        session=session, repository_id=auth.repository.id, numbers=issue_numbers
    )

    issue_ids = [issue.id for issue in issues]
    pledges = await pledge_service.get_by_issue_ids(
        session=session, issue_ids=issue_ids
    )
    issue_references = await issue_service.list_issue_references_for_issues(
        session, issue_ids=issue_ids
    )

    pledges_by_issue_id: dict[UUID, list[Pledge]] = {}
    for pledge in pledges:
        if pledge.issue_id not in pledges_by_issue_id:
            pledges_by_issue_id[pledge.issue_id] = []
        pledges_by_issue_id[pledge.issue_id].append(pledge)

    references_by_issue_id: dict[UUID, list[IssueReference]] = {}
    for reference in issue_references:
        if reference.issue_id not in references_by_issue_id:
            references_by_issue_id[reference.issue_id] = []
        references_by_issue_id[reference.issue_id].append(reference)

    ret = []
    for issue in issues:
        pledges = pledges_by_issue_id.get(issue.id, [])
        references = references_by_issue_id.get(issue.id, [])
        if pledges or references:
            issue_extension = IssueExtensionRead(
                number=issue.number,
                pledges=[PledgeRead.from_db(p) for p in pledges],
                references=[IssueReferenceRead.from_model(r) for r in references],
            )
            ret.append(issue_extension)

    return ret
