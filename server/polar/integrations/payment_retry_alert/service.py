from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import structlog

from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Payment
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.order.repository import OrderRepository
from polar.order.service import PaymentAlreadyInProgress, PaymentFailed
from polar.order.service import order as order_service
from polar.payment.repository import PaymentRepository
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncSession

from .types import RETRY_NOW_NOTIFICATION_TYPE, PaymentRetryAlert

log: Logger = structlog.get_logger()

STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID = "payment_retry_alert_id"

# Mastercard watches a declined card for up to 30 days.
MATCHING_WINDOW = timedelta(days=31)
DECLINE_TIME_TOLERANCE = timedelta(days=1)


class SkipReason(StrEnum):
    unmatched = "unmatched"
    not_in_dunning = "not_in_dunning"
    subscription_ended = "subscription_ended"
    payment_in_progress = "payment_in_progress"
    max_attempts_reached = "max_attempts_reached"
    non_recoverable_decline = "non_recoverable_decline"
    payment_method_changed = "payment_method_changed"
    not_charged = "not_charged"


def _is_same_network_transaction(
    payment_network_transaction_id: str | None, alert_network_transaction_id: str
) -> bool:
    if payment_network_transaction_id is None:
        return False
    if payment_network_transaction_id == alert_network_transaction_id:
        return True
    # Stripe reports the Mastercard Trace ID: a 3-character network code, the
    # Banknet reference and the MMDD settlement date. Alerts may carry the
    # Banknet reference alone.
    return (
        len(payment_network_transaction_id) == len(alert_network_transaction_id) + 7
        and payment_network_transaction_id[3:-4] == alert_network_transaction_id
    )


def _get_single_order_payment(payments: Sequence[Payment]) -> Payment | None:
    if len({payment.order_id for payment in payments}) != 1:
        return None
    return payments[0]


class PaymentRetryAlertService:
    async def handle_alert(
        self, session: AsyncSession, alert: PaymentRetryAlert
    ) -> None:
        if alert["notification_type"] != RETRY_NOW_NOTIFICATION_TYPE:
            return

        skip_reason = await self._retry_declined_payment(session, alert)
        if skip_reason is None:
            return

        log.info(
            "Payment retry alert not attempted",
            alert_id=alert["id"],
            reason=skip_reason,
        )

    async def _retry_declined_payment(
        self, session: AsyncSession, alert: PaymentRetryAlert
    ) -> SkipReason | None:
        declined_payment = await self._match_declined_payment(session, alert)
        if declined_payment is None or declined_payment.order_id is None:
            return SkipReason.unmatched

        order_repository = OrderRepository.from_session(session)
        order = await order_repository.get_by_id(
            declined_payment.order_id,
            options=order_repository.get_eager_options(),
        )
        if (
            order is None
            or order.status != OrderStatus.pending
            or order.next_payment_attempt_at is None
        ):
            return SkipReason.not_in_dunning

        subscription = order.subscription
        if subscription is None or subscription.ended_at is not None:
            return SkipReason.subscription_ended

        payment_repository = PaymentRepository.from_session(session)
        attempts = await payment_repository.count_payments_for_order_by_trigger(
            order.id, PaymentTrigger.retry_payment_alert
        )
        if attempts >= settings.PAYMENT_RETRY_ALERT_MAX_ATTEMPTS:
            return SkipReason.max_attempts_reached

        latest_payment = await payment_repository.get_latest_for_order(order.id)
        if latest_payment is not None and latest_payment.is_non_recoverable:
            return SkipReason.non_recoverable_decline

        payment_method = None
        if subscription.payment_method_id is not None:
            payment_method = await PaymentMethodRepository.from_session(
                session
            ).get_by_id_and_customer(subscription.payment_method_id, order.customer_id)
        declined_fingerprint = declined_payment.method_metadata.get("fingerprint")
        if (
            payment_method is None
            or declined_fingerprint is None
            or payment_method.fingerprint != declined_fingerprint
        ):
            return SkipReason.payment_method_changed

        log.info(
            "Retrying payment from payment retry alert",
            alert_id=alert["id"],
            order_id=order.id,
            attempt=attempts + 1,
        )
        try:
            payment_intent = await order_service.trigger_payment(
                session,
                order,
                payment_method,
                payment_trigger=PaymentTrigger.retry_payment_alert,
                extra_metadata={STRIPE_METADATA_PAYMENT_RETRY_ALERT_ID: alert["id"]},
                idempotency_key=f"payment_retry_alert:{alert['id']}",
            )
        except PaymentAlreadyInProgress:
            return SkipReason.payment_in_progress
        except PaymentFailed:
            return None

        if payment_intent is None:
            return SkipReason.not_charged
        return None

    async def _match_declined_payment(
        self, session: AsyncSession, alert: PaymentRetryAlert
    ) -> Payment | None:
        network_transaction_id = alert["network_transaction_id"] or None
        last4 = alert["card_last_four"] or None

        repository = PaymentRepository.from_session(session)
        candidates = await repository.get_failed_card_payments_in_dunning(
            brand="mastercard",
            since=utc_now() - MATCHING_WINDOW,
            network_transaction_id=network_transaction_id,
            last4=None if network_transaction_id else last4,
        )

        if network_transaction_id is not None:
            return _get_single_order_payment(
                [
                    candidate
                    for candidate in candidates
                    if _is_same_network_transaction(
                        candidate.method_metadata.get("network_transaction_id"),
                        network_transaction_id,
                    )
                ]
            )

        amount = alert["transaction_amount_in_cents"]
        if last4 is None or amount is None or not alert["transaction_time"]:
            return None
        currency = alert["transaction_currency"].lower()
        declined_at = datetime.fromisoformat(alert["transaction_time"])
        if declined_at.tzinfo is None:
            declined_at = declined_at.replace(tzinfo=UTC)
        return _get_single_order_payment(
            [
                candidate
                for candidate in candidates
                if candidate.method_metadata.get("last4") == last4
                and candidate.amount == amount
                and candidate.currency == currency
                and abs(candidate.created_at - declined_at) <= DECLINE_TIME_TOLERANCE
            ]
        )


payment_retry_alert = PaymentRetryAlertService()
