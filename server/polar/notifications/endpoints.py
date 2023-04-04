from fastapi import APIRouter, Depends

from polar.auth.dependencies import Auth
from polar.issue.schemas import IssueRead
from polar.models.notification import Notification
from polar.models.pledge import Pledge
from polar.pledge.schemas import PledgeRead
from polar.postgres import AsyncSession, get_db_session

from .schemas import NotificationRead
from .service import notifications

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=list[NotificationRead])
async def get(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[NotificationRead]:
    notifs = await notifications.get_for_user(session, auth.user.id)

    def decorate(n: Notification) -> NotificationRead:
        return NotificationRead(
            id=n.id,
            type=n.type,
            created_at=n.created_at,
            pledge=PledgeRead.from_db(n.pledge) if n.pledge else None,
            issue=IssueRead.from_orm(n.issue) if n.issue else None,
        )

    return [decorate(n) for n in notifs]
