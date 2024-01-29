from uuid import UUID

from fastapi import APIRouter, Depends, Request

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.extension.schemas import IssueExtensionRead
from polar.issue.schemas import Issue, IssueReferenceRead
from polar.issue.service import issue as issue_service
from polar.kit import utils
from polar.models.issue_reference import IssueReference
from polar.models.pledge import Pledge
from polar.organization.service import organization as organization_service
from polar.pledge.schemas import Pledge as PledgeSchema
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.repository.service import repository as repository_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

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
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[IssueExtensionRead]:
    if not auth.user:
        raise Unauthorized()

    org = await organization_service.get_by_name(session, platform, org_name)
    if not org:
        raise ResourceNotFound()

    # only if user is a member of this org
    if not await user_organization_service.get_by_user_and_org(
        session,
        auth.user.id,
        organization_id=org.id,
    ):
        raise Unauthorized()

    repo = await repository_service.get_by_org_and_name(
        session, organization_id=org.id, name=repo_name
    )
    if not repo:
        raise ResourceNotFound()

    # Update when we last saw this user and on which extension version
    version = "unknown"
    auth.user.last_seen_at_extension = utils.utc_now()
    if request.headers.get("x-polar-agent"):
        parts = request.headers["x-polar-agent"].split("/")
        if len(parts) == 2:
            version = parts[1]
            auth.user.last_version_extension = version

    await auth.user.save(session=session)
    posthog.user_event_raw(
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
        session=session, repository_id=repo.id, numbers=issue_numbers
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
                pledges=[PledgeSchema.from_db(p) for p in pledges],
                references=[IssueReferenceRead.from_model(r) for r in references],
                issue=Issue.from_db(issue),
            )
            ret.append(issue_extension)

    return ret
