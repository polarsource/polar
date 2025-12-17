import functools
import uuid
from collections.abc import Awaitable, Callable
from typing import ParamSpec, cast

import stripe as stripe_lib
import structlog
from dramatiq import Retry

from polar.account.service import account as account_service
from polar.checkout.service import NotConfirmedCheckout
from polar.dispute.service import dispute as dispute_service
from polar.external_event.service import external_event as external_event_service
from polar.integrations.stripe.schemas import PaymentIntentSuccessWebhook, ProductType
from polar.logging import Logger
from polar.payment.service import UnhandledPaymentIntent
from polar.payment.service import payment as payment_service
from polar.payment_method.service import payment_method as payment_method_service
from polar.payout.service import payout as payout_service
from polar.pledge.service import pledge as pledge_service
from polar.refund.service import MissingRelatedDispute, RefundPendingCreation
from polar.refund.service import refund as refund_service
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.payment import BalanceTransactionNotAvailableError
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.user.service import user as user_service
from polar.worker import AsyncSessionMaker, TaskPriority, actor, can_retry, get_retries

from . import payment
from .service import stripe as stripe_service

log: Logger = structlog.get_logger()


Params = ParamSpec("Params")


def stripe_api_connection_error_retry[**Params, ReturnValue](
    func: Callable[Params, Awaitable[ReturnValue]],
) -> Callable[Params, Awaitable[ReturnValue]]:
    @functools.wraps(func)
    async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
        try:
            return await func(*args, **kwargs)
        except stripe_lib.APIConnectionError as e:
            log.warning(
                "Retry after Stripe API connection error",
                e=str(e),
                job_try=get_retries(),
            )
            raise Retry() from e

    return wrapper


@actor(actor_name="stripe.webhook.account.updated", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def account_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            stripe_account = cast(stripe_lib.Account, event.stripe_data.data.object)
            log.info(f"Processing Stripe Account {stripe_account.id}")
            await account_service.update_account_from_stripe(
                session, stripe_account=stripe_account
            )


@actor(actor_name="stripe.webhook.payment_intent.succeeded", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def payment_intent_succeeded(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            payment_intent = cast(
                stripe_lib.PaymentIntent, event.stripe_data.data.object
            )
            payload = PaymentIntentSuccessWebhook.model_validate(payment_intent)

            # payment for pay_on_completion
            # metadata is on the invoice, not the payment_intent
            if payload.invoice:
                invoice = await stripe_service.get_invoice(payload.invoice)
                if (
                    invoice.metadata
                    and invoice.metadata.get("type") == ProductType.pledge
                ):
                    await pledge_service.handle_payment_intent_success(
                        session=session,
                        payload=payload,
                    )
                return

            # Handle retry payments - save credit card and update subscription payment method
            if payment_intent.metadata and payment_intent.metadata.get("order_id"):
                order = await payment.resolve_order(session, payment_intent, None)
                if order is not None:
                    payment_method = await payment_method_service.upsert_from_stripe_payment_intent_for_order(
                        session, payment_intent, order
                    )

                    if payment_method and order.subscription:
                        await subscription_service.update_payment_method_from_retry(
                            session, order.subscription, payment_method
                        )
                return


@actor(
    actor_name="stripe.webhook.payment_intent.payment_failed",
    priority=TaskPriority.HIGH,
)
@stripe_api_connection_error_retry
async def payment_intent_payment_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            payment_intent = cast(
                stripe_lib.PaymentIntent, event.stripe_data.data.object
            )
            try:
                await payment.handle_failure(session, payment_intent)

            except UnhandledPaymentIntent:
                pass
            except payment.OrderDoesNotExist as e:
                # Retry because we may not have been able to handle the order yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.setup_intent.succeeded", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def setup_intent_succeeded(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            setup_intent = cast(stripe_lib.SetupIntent, event.stripe_data.data.object)
            try:
                await payment.handle_success(session, setup_intent)
            except (NotConfirmedCheckout, payment.OrderDoesNotExist) as e:
                # Retry because we've seen in the wild a Stripe webhook coming
                # *before* we updated the Checkout Session status in the database!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise
            except payment.OutdatedCheckoutIntent:
                # Ignore outdated setup intents
                # Expected flow after a a trial already redeemed error
                pass


@actor(
    actor_name="stripe.webhook.setup_intent.setup_failed", priority=TaskPriority.HIGH
)
@stripe_api_connection_error_retry
async def setup_intent_setup_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            setup_intent = cast(stripe_lib.SetupIntent, event.stripe_data.data.object)
            try:
                await payment.handle_failure(session, setup_intent)
            except payment.OrderDoesNotExist as e:
                # Retry because we may not have been able to handle the order yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.charge.pending", priority=TaskPriority.HIGH)
async def charge_pending(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            checkout = await payment.resolve_checkout(session, charge)
            try:
                order = await payment.resolve_order(session, charge, checkout)
            except payment.OrderDoesNotExist as e:
                # Retry because we may not have been able to handle the order yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise
            await payment_service.upsert_from_stripe_charge(
                session, charge, checkout, None, order
            )


@actor(actor_name="stripe.webhook.charge.failed", priority=TaskPriority.HIGH)
async def charge_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            try:
                await payment.handle_failure(session, charge)
            except payment.OrderDoesNotExist as e:
                # Retry because we may not have been able to handle the order yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.charge.succeeded", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_succeeded(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            try:
                await payment.handle_success(session, charge)
            except (NotConfirmedCheckout, payment.OrderDoesNotExist) as e:
                # Retry because we've seen in the wild a Stripe webhook coming
                # *before* we updated the Checkout Session status in the database!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.charge.updated", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            if charge.status != "succeeded":
                return
            try:
                await payment_transaction_service.create_payment(session, charge=charge)
            except BalanceTransactionNotAvailableError:
                return


@actor(actor_name="stripe.webhook.refund.created", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def refund_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            refund = cast(stripe_lib.Refund, event.stripe_data.data.object)
            log.info(
                "stripe.webhook.refund.created",
                refund_id=refund.id,
                charge_id=refund.charge,
                payment_intent=refund.payment_intent,
            )
            try:
                await refund_service.upsert_from_stripe(session, stripe_refund=refund)
            except (RefundPendingCreation, MissingRelatedDispute) as e:
                log.warning(e.message, event_id=event.id)
                # Retry because we may not have been able to handle the refund/dispute yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.refund.updated", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def refund_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            refund = cast(stripe_lib.Refund, event.stripe_data.data.object)
            log.info(
                "stripe.webhook.refund.updated",
                refund_id=refund.id,
                charge_id=refund.charge,
                payment_intent=refund.payment_intent,
            )
            try:
                await refund_service.upsert_from_stripe(session, stripe_refund=refund)
            except (RefundPendingCreation, MissingRelatedDispute) as e:
                log.warning(e.message, event_id=event.id)
                # Retry because we may not have been able to handle the refund/dispute yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.refund.failed", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def refund_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            refund = cast(stripe_lib.Refund, event.stripe_data.data.object)
            log.info(
                "stripe.webhook.refund.failed",
                refund_id=refund.id,
                charge_id=refund.charge,
                payment_intent=refund.payment_intent,
            )
            try:
                await refund_service.upsert_from_stripe(session, stripe_refund=refund)
            except (RefundPendingCreation, MissingRelatedDispute) as e:
                log.warning(e.message, event_id=event.id)
                # Retry because we may not have been able to handle the refund/dispute yet
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.charge.dispute.created", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_dispute_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            dispute = cast(stripe_lib.Dispute, event.stripe_data.data.object)
            await dispute_service.upsert_from_stripe(session, dispute)


@actor(actor_name="stripe.webhook.charge.dispute.updated", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_dispute_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            dispute = cast(stripe_lib.Dispute, event.stripe_data.data.object)
            await dispute_service.upsert_from_stripe(session, dispute)


@actor(actor_name="stripe.webhook.charge.dispute.closed", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_dispute_closed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            dispute = cast(stripe_lib.Dispute, event.stripe_data.data.object)
            await dispute_service.upsert_from_stripe(session, dispute)


@actor(actor_name="stripe.webhook.payout.updated", priority=TaskPriority.LOW)
@stripe_api_connection_error_retry
async def payout_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            payout = cast(stripe_lib.Payout, event.stripe_data.data.object)
            await payout_service.update_from_stripe(session, payout)


@actor(actor_name="stripe.webhook.payout.paid", priority=TaskPriority.LOW)
@stripe_api_connection_error_retry
async def payout_paid(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            payout = cast(stripe_lib.Payout, event.stripe_data.data.object)
            await payout_service.update_from_stripe(session, payout)


@actor(
    actor_name="stripe.webhook.identity.verification_session.verified",
    priority=TaskPriority.HIGH,
)
async def identity_verification_session_verified(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            verification_session = cast(
                stripe_lib.identity.VerificationSession, event.stripe_data.data.object
            )
            await user_service.identity_verification_verified(
                session, verification_session
            )


@actor(
    actor_name="stripe.webhook.identity.verification_session.processing",
    priority=TaskPriority.HIGH,
)
async def identity_verification_session_processing(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            verification_session = cast(
                stripe_lib.identity.VerificationSession, event.stripe_data.data.object
            )
            await user_service.identity_verification_pending(
                session, verification_session
            )


@actor(
    actor_name="stripe.webhook.identity.verification_session.requires_input",
    priority=TaskPriority.HIGH,
)
async def identity_verification_session_requires_input(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            verification_session = cast(
                stripe_lib.identity.VerificationSession, event.stripe_data.data.object
            )
            await user_service.identity_verification_failed(
                session, verification_session
            )
