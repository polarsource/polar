from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import ColumnElement, and_, or_, select

from polar.config import settings
from polar.kit.db.models import RecordModel
from polar.kit.utils import utc_now
from polar.models import (
    AuthenticationSession,
    CustomerEmailVerification,
    CustomerSession,
    CustomerSessionCode,
    EmailLog,
    EmailOTP,
    EmailVerification,
    ExternalEvent,
    MemberSession,
    OAuth2State,
    OAuth2Token,
    UserSession,
    WebhookDelivery,
    WebhookEvent,
)

from .base import Invariant, InvariantError


@dataclass(frozen=True)
class CleanupTask:
    actor_name: str
    model: type[RecordModel]
    deletable_clause: Callable[[datetime], ColumnElement[bool]]


CLEANUP_TASKS: tuple[CleanupTask, ...] = (
    CleanupTask(
        "authentication_session.delete_expired",
        AuthenticationSession,
        lambda cutoff: AuthenticationSession.expires_at < int(cutoff.timestamp()),
    ),
    CleanupTask(
        "email_otp.delete_expired",
        EmailOTP,
        lambda cutoff: EmailOTP.expires_at < int(cutoff.timestamp()),
    ),
    CleanupTask(
        "oauth2_state.delete_expired",
        OAuth2State,
        lambda cutoff: OAuth2State.expires_at < int(cutoff.timestamp()),
    ),
    CleanupTask(
        "customer_session_code.delete_expired",
        CustomerSessionCode,
        lambda cutoff: CustomerSessionCode.expires_at < cutoff,
    ),
    CleanupTask(
        "email_update.delete_expired_record",
        EmailVerification,
        lambda cutoff: EmailVerification.expires_at < cutoff,
    ),
    CleanupTask(
        "customer_email_update.delete_expired",
        CustomerEmailVerification,
        lambda cutoff: CustomerEmailVerification.expires_at < cutoff,
    ),
    CleanupTask(
        "customer_session.delete_expired",
        CustomerSession,
        lambda cutoff: CustomerSession.expires_at < cutoff,
    ),
    CleanupTask(
        "member_session.delete_expired",
        MemberSession,
        lambda cutoff: MemberSession.expires_at < cutoff,
    ),
    CleanupTask(
        "oauth2_token.delete_expired",
        OAuth2Token,
        lambda cutoff: and_(
            OAuth2Token.issued_at + OAuth2Token.expires_in < int(cutoff.timestamp()),
            or_(
                OAuth2Token.refresh_token.is_(None),
                and_(
                    OAuth2Token.refresh_token_revoked_at != 0,
                    OAuth2Token.refresh_token_revoked_at < int(cutoff.timestamp()),
                ),
            ),
        ),
    ),
    CleanupTask(
        "auth.delete_expired",
        UserSession,
        lambda cutoff: UserSession.expires_at < cutoff,
    ),
    CleanupTask(
        "external_event.prune",
        ExternalEvent,
        lambda cutoff: and_(
            ExternalEvent.handled_at < cutoff,
            ExternalEvent.created_at
            < cutoff - settings.EXTERNAL_EVENT_RETENTION_PERIOD,
        ),
    ),
    CleanupTask(
        "email_log.prune",
        EmailLog,
        lambda cutoff: (
            EmailLog.created_at < cutoff - settings.EMAIL_LOG_RETENTION_PERIOD
        ),
    ),
    CleanupTask(
        "webhook_event.archive",
        WebhookEvent,
        lambda cutoff: and_(
            WebhookEvent.payload.is_not(None),
            WebhookEvent.created_at < cutoff - settings.WEBHOOK_EVENT_RETENTION_PERIOD,
        ),
    ),
    CleanupTask(
        "webhook_delivery.archive",
        WebhookDelivery,
        lambda cutoff: and_(
            WebhookDelivery.response.is_not(None),
            WebhookDelivery.created_at
            < cutoff - settings.WEBHOOK_DELIVERY_PAYLOAD_RETENTION_PERIOD,
        ),
    ),
)


class ExpiredRecordsNotDeletedInvariantError(InvariantError):
    def __init__(self, actor_names: Sequence[str]) -> None:
        super().__init__(
            ExpiredRecordsNotDeletedInvariant,
            f"Found records past their retention period for {len(actor_names)} "
            "cleanup tasks; they may have stopped running.",
            {"cleanup_tasks": list(actor_names)},
        )


class ExpiredRecordsNotDeletedInvariant(Invariant):
    """
    Records past their retention period must be deleted by their cleanup task.

    Each cleanup task runs once a day, so a record is only overdue once it has been
    deletable for a full cleanup cycle, plus some leeway for the task to complete.
    """

    CLEANUP_INTERVAL = timedelta(days=1)
    LEEWAY = timedelta(hours=1)

    async def check(self) -> None:
        cutoff = utc_now() - self.CLEANUP_INTERVAL - self.LEEWAY
        overdue: list[str] = []
        for cleanup_task in CLEANUP_TASKS:
            statement = (
                select(cleanup_task.model.id)
                .where(cleanup_task.deletable_clause(cutoff))
                .limit(1)
            )
            result = await self.session.execute(statement)
            if result.scalar_one_or_none() is not None:
                overdue.append(cleanup_task.actor_name)

        if overdue:
            raise ExpiredRecordsNotDeletedInvariantError(overdue)
