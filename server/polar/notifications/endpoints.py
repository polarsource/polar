import structlog
from fastapi import APIRouter, Depends

from polar.auth.dependencies import UserRequiredAuth
from polar.models.notification import Notification
from polar.notifications.notification import (
    MaintainerAccountReviewedNotification,
    MaintainerAccountUnderReviewNotification,
    MaintainerNewPaidSubscriptionNotification,
    MaintainerPledgeConfirmationPendingNotification,
    MaintainerPledgeCreatedNotification,
    MaintainerPledgedIssueConfirmationPendingNotification,
    MaintainerPledgedIssuePendingNotification,
    MaintainerPledgePaidNotification,
    MaintainerPledgePendingNotification,
    PledgerPledgePendingNotification,
    RewardPaidNotification,
    TeamAdminMemberPledgedNotification,
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
                type=NotificationType(n.type),
                created_at=n.created_at,
            )

            if isinstance(payload, MaintainerPledgeCreatedNotification):
                notif.maintainer_pledge_created = payload
            if isinstance(payload, MaintainerPledgeConfirmationPendingNotification):
                notif.maintainer_pledge_confirmation_pending = payload
            if isinstance(payload, MaintainerPledgePendingNotification):
                notif.maintainer_pledge_pending = payload
            if isinstance(payload, MaintainerPledgePaidNotification):
                notif.maintainer_pledge_paid = payload
            if isinstance(payload, PledgerPledgePendingNotification):
                notif.pledger_pledge_pending = payload
            if isinstance(payload, RewardPaidNotification):
                notif.reward_paid = payload
            if isinstance(
                payload, MaintainerPledgedIssueConfirmationPendingNotification
            ):
                notif.maintainer_pledged_issue_confirmation_pending = payload
            if isinstance(payload, MaintainerPledgedIssuePendingNotification):
                notif.maintainer_pledged_issue_pending = payload
            if isinstance(payload, TeamAdminMemberPledgedNotification):
                notif.team_admin_member_pledged = payload
            if isinstance(payload, MaintainerAccountUnderReviewNotification):
                notif.maintainer_account_under_review = payload
            if isinstance(payload, MaintainerAccountReviewedNotification):
                notif.maintainer_account_reviewed = payload
            if isinstance(payload, MaintainerNewPaidSubscriptionNotification):
                notif.maintainer_new_paid_subscription = payload

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
