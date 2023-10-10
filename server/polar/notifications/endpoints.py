import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import UserRequiredAuth
from polar.models.notification import Notification
from polar.notifications.notification import (
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgedIssueConfirmationPendingNotification,
    MaintainerPledgedIssuePendingNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
    RewardPaidNotification,
)
from polar.postgres import AsyncSession, get_db_session

from .schemas import (
    NotificationRead,
    NotificationsList,
    NotificationsMarkRead,
    NotificationType,
)
from .service import notifications

router = APIRouter(tags=["notifications"])


log = structlog.get_logger()


@router.get("/notifications", response_model=NotificationsList)
async def get(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> NotificationsList:
    notifs = await notifications.get_for_user(session, auth.user.id)

    def decorate(n: Notification) -> NotificationRead | None:
        try:
            payload = notifications.parse_payload(n)
            notif = NotificationRead(
                id=n.id,
                type=NotificationType.from_str(n.type),
                created_at=n.created_at,
                payload=payload,  # deprecated
            )

            if isinstance(payload, MaintainerPledgeCreatedNotification):
                notif.maintainerPledgeCreated = payload
            if isinstance(payload, MaintainerPledgeConfirmationPendingNotification):
                notif.maintainerPledgeConfirmationPending = payload
            if isinstance(payload, MaintainerPledgePendingNotification):
                notif.maintainerPledgePending = payload
            if isinstance(payload, MaintainerPledgePaidNotification):
                notif.maintainerPledgePaid = payload
            if isinstance(payload, PledgerPledgePendingNotification):
                notif.pledgerPledgePending = payload
            if isinstance(payload, RewardPaidNotification):
                notif.rewardPaid = payload
            if isinstance(
                payload, MaintainerPledgedIssueConfirmationPendingNotification
            ):
                notif.maintainerPledgedIssueConfirmationPending = payload
            if isinstance(payload, MaintainerPledgedIssuePendingNotification):
                notif.maintainerPledgedIssuePending = payload

            return notif
        except Exception as e:
            log.error("failed to parse notification", e=e)
            return None

    res = [decorate(n) for n in notifs]
    list = [v for v in res if v is not None]

    last_read_notification_id = await notifications.get_user_last_read(
        session, auth.user.id
    )

    return NotificationsList(
        notifications=list, last_read_notification_id=last_read_notification_id
    )


@router.post("/notifications/read")
async def mark_read(
    read: NotificationsMarkRead,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await notifications.set_user_last_read(session, auth.user.id, read.notification_id)
    return None
