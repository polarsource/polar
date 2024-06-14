from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUserOrAnonymous
from polar.authz.service import AccessType, Authz
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.issue.service import issue as issue_service
from polar.kit.pagination import ListResource, Pagination
from polar.postgres import (
    AsyncSession,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import PullRequest
from .service import pull_request as pull_request_service

router = APIRouter(tags=["pull_requests"])


@router.get(
    "/pull_requests/search",
    response_model=ListResource[PullRequest],
    description="Search pull requests.",
    summary="Search pull requests",
    status_code=200,
    responses={404: {}},
)
async def search(
    auth_subject: WebUserOrAnonymous,
    references_issue_id: UUID | None = Query(
        default=None, description="Search pull requests that are mentioning this issue"
    ),
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[PullRequest]:
    if not references_issue_id:
        raise ResourceNotFound("mentioning_issue_id is not set")

    issue = await issue_service.get(session, references_issue_id)
    if not issue:
        raise ResourceNotFound("issue not found")
    if not await authz.can(auth_subject.subject, AccessType.read, issue):
        raise Unauthorized()

    prs = await pull_request_service.list_referencing_issue(session, issue)

    return ListResource(
        items=[PullRequest.from_db(pr) for pr in prs],
        pagination=Pagination(total_count=len(prs), max_page=1),
    )
