from fastapi import APIRouter, Depends
import structlog

from polar.auth.dependencies import Auth
from polar.issue.schemas import IssueRead
from polar.models.notification import Notification
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead
from polar.postgres import AsyncSession, get_db_session
from polar.pull_request.schemas import PullRequestRead

from .schemas import NotificationRead, NotificationType
from .service import notifications

router = APIRouter(tags=["notifications"])


log = structlog.get_logger()


@router.get("/notifications", response_model=list[NotificationRead])
async def get(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[NotificationRead]:
    notifs = await notifications.get_for_user(session, auth.user.id)

    def decorate(n: Notification) -> NotificationRead | None:
        try:
            return NotificationRead(
                id=n.id,
                type=NotificationType.from_str(n.type),
                created_at=n.created_at,
                pledge=PledgeRead.from_db(n.pledge) if n.pledge else None,
                issue=IssueRead.from_orm(n.issue) if n.issue else None,
                pull_request=PullRequestRead.from_orm(n.pull_request)
                if n.pull_request
                else None,
                payload=notifications.parse_payload(n),
            )
        except Exception as e:
            log.error("failed to parse notification", e=e)
            return None

    res = [decorate(n) for n in notifs]
    return [v for v in res if v is not None]
