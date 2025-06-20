import functools
import uuid
from collections.abc import Awaitable, Callable
from typing import ParamSpec, TypeVar, cast

import stripe as stripe_lib
import structlog
from dramatiq import Retry

from polar.account.service import account as account_service
from polar.checkout.service import NotConfirmedCheckout
from polar.checkout.service import checkout as checkout_service
from polar.exceptions import PolarTaskError
from polar.external_event.service import external_event as external_event_service
from polar.integrations.stripe.schemas import PaymentIntentSuccessWebhook, ProductType
from polar.logging import Logger
from polar.order.service import (
    NotAnOrderInvoice,
    NotASubscriptionInvoice,
    OrderDoesNotExist,
)
from polar.order.service import (
    SubscriptionDoesNotExist as OrderSubscriptionDoesNotExist,
)
from polar.order.service import order as order_service
from polar.payment.service import UnhandledPaymentIntent
from polar.payment.service import payment as payment_service
from polar.payout.service import payout as payout_service
from polar.pledge.service import pledge as pledge_service
from polar.refund.service import refund as refund_service
from polar.subscription.service import SubscriptionDoesNotExist
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.dispute import (
    DisputeClosed,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.user.service import user as user_service
from polar.worker import AsyncSessionMaker, TaskPriority, actor, can_retry, get_retries

from .service import stripe as stripe_service

log: Logger = structlog.get_logger()


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def stripe_api_connection_error_retry(
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


class StripeTaskError(PolarTaskError): ...


@actor(actor_name="stripe.webhook.account.updated", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def account_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            stripe_account = cast(stripe_lib.Account, event.stripe_data.data.object)
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
            metadata = payment_intent.get("metadata", {})

            # Payment for Polar Checkout Session
            if (
                metadata.get("type") == ProductType.product
                and (checkout_id := metadata.get("checkout_id")) is not None
            ):
                try:
                    await checkout_service.handle_stripe_success(
                        session, uuid.UUID(checkout_id), payment_intent
                    )
                except NotConfirmedCheckout as e:
                    # Retry because we've seen in the wild a Stripe webhook coming
                    # *before* we updated the Checkout Session status in the database!
                    if can_retry():
                        raise Retry() from e
                    # Raise the exception to be notified about it
                    else:
                        raise
                return

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

            log.error(
                "stripe.webhook.payment_intent.succeeded.not_handled",
                pi=payload.id,
            )


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
            metadata = payment_intent.metadata or {}

            try:
                await payment_service.create_from_stripe_payment_intent(
                    session, payment_intent
                )
            except UnhandledPaymentIntent:
                pass


@actor(actor_name="stripe.webhook.setup_intent.succeeded", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def setup_intent_succeeded(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            setup_intent = cast(stripe_lib.SetupIntent, event.stripe_data.data.object)
            metadata = setup_intent.metadata or {}

        # Intent for Polar Checkout Session
        if (
            metadata.get("type") == ProductType.product
            and (checkout_id := metadata.get("checkout_id")) is not None
        ):
            try:
                await checkout_service.handle_stripe_success(
                    session, uuid.UUID(checkout_id), setup_intent
                )
            except NotConfirmedCheckout as e:
                # Retry because we've seen in the wild a Stripe webhook coming
                # *before* we updated the Checkout Session status in the database!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise
            return


@actor(
    actor_name="stripe.webhook.setup_intent.setup_failed", priority=TaskPriority.HIGH
)
@stripe_api_connection_error_retry
async def setup_intent_setup_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            setup_intent = cast(stripe_lib.SetupIntent, event.stripe_data.data.object)
            metadata = setup_intent.metadata or {}

            # Payment for Polar Checkout Session
            if (
                metadata.get("type") == ProductType.product
                and (checkout_id := metadata.get("checkout_id")) is not None
            ):
                await checkout_service.handle_payment_failed(
                    session, uuid.UUID(checkout_id)
                )


@actor(actor_name="stripe.webhook.charge.pending", priority=TaskPriority.HIGH)
async def charge_pending(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            await payment_service.upsert_from_stripe_charge(session, charge)


@actor(actor_name="stripe.webhook.charge.failed", priority=TaskPriority.HIGH)
async def charge_failed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            await payment_service.upsert_from_stripe_charge(session, charge)


@actor(actor_name="stripe.webhook.charge.succeeded", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_succeeded(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            charge = cast(stripe_lib.Charge, event.stripe_data.data.object)
            await payment_service.upsert_from_stripe_charge(session, charge)
            await payment_transaction_service.create_payment(
                session=session, charge=charge
            )


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
            await refund_service.create_from_stripe(session, stripe_refund=refund)


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
            await refund_service.upsert_from_stripe(session, stripe_refund=refund)


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
            await refund_service.upsert_from_stripe(session, stripe_refund=refund)


@actor(actor_name="stripe.webhook.charge.dispute.closed", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def charge_dispute_closed(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            dispute = cast(stripe_lib.Dispute, event.stripe_data.data.object)

            try:
                await dispute_transaction_service.create_dispute(
                    session, dispute=dispute
                )
            except DisputeClosed:
                # The dispute was closed without any action, do nothing
                pass


@actor(
    actor_name="stripe.webhook.customer.subscription.updated",
    priority=TaskPriority.HIGH,
)
@stripe_api_connection_error_retry
async def customer_subscription_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            subscription = cast(stripe_lib.Subscription, event.stripe_data.data.object)
            try:
                await subscription_service.update_from_stripe(
                    session, stripe_subscription=subscription
                )
            except SubscriptionDoesNotExist as e:
                log.warning(e.message, event_id=event.id)
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(
    actor_name="stripe.webhook.customer.subscription.deleted",
    priority=TaskPriority.HIGH,
)
@stripe_api_connection_error_retry
async def customer_subscription_deleted(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            subscription = cast(stripe_lib.Subscription, event.stripe_data.data.object)
            try:
                await subscription_service.update_from_stripe(
                    session, stripe_subscription=subscription
                )
            except SubscriptionDoesNotExist as e:
                log.warning(e.message, event_id=event.id)
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


@actor(actor_name="stripe.webhook.invoice.created", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def invoice_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            invoice = cast(stripe_lib.Invoice, event.stripe_data.data.object)
            try:
                await order_service.create_order_from_stripe(session, invoice=invoice)
            except OrderSubscriptionDoesNotExist as e:
                log.warning(e.message, event_id=event.id)
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise
            except (NotAnOrderInvoice, NotASubscriptionInvoice):
                # Ignore invoices that are not for products (pledges) and subscriptions
                return


@actor(actor_name="stripe.webhook.invoice.paid", priority=TaskPriority.HIGH)
@stripe_api_connection_error_retry
async def invoice_paid(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle_stripe(session, event_id) as event:
            invoice = cast(stripe_lib.Invoice, event.stripe_data.data.object)
            try:
                await order_service.update_order_from_stripe(session, invoice=invoice)
            except OrderDoesNotExist as e:
                log.warning(e.message, event_id=event.id)
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle invoice.created yet!
                if can_retry():
                    raise Retry() from e
                # Raise the exception to be notified about it
                else:
                    raise


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
