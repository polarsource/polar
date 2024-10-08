import uuid
from typing import Any

import stripe
import structlog
from arq import Retry

from polar.account.service import account as account_service
from polar.checkout.service import checkout as checkout_service
from polar.donation.service import donation_service
from polar.exceptions import PolarTaskError
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PaymentIntentSuccessWebhook,
    ProductType,
)
from polar.order.service import NotAnOrderInvoice
from polar.order.service import (
    SubscriptionDoesNotExist as OrderSubscriptionDoesNotExist,
)
from polar.order.service import order as order_service
from polar.pledge.service import pledge as pledge_service
from polar.subscription.service import SubscriptionDoesNotExist
from polar.subscription.service import subscription as subscription_service
from polar.transaction.service.balance import PaymentTransactionForChargeDoesNotExist
from polar.transaction.service.dispute import (
    DisputeUnknownPaymentTransaction,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.payment import (
    DonationDoesNotExist as PaymentTransactionDonationDoesNotExist,
)
from polar.transaction.service.payment import (
    PledgeDoesNotExist as PaymentTransactionPledgeDoesNotExist,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import stripe as stripe_service

log = structlog.get_logger()

MAX_RETRIES = 5
DELAY = 10


class StripeTaskError(PolarTaskError): ...


class UnsetAccountOnPayoutEvent(StripeTaskError):
    def __init__(self, event_id: str) -> None:
        self.event_id = event_id
        message = (
            f"Received the payout.paid event {event_id}, "
            "but the connected account is not set"
        )
        super().__init__(message)


@task("stripe.webhook.account.updated")
async def account_updated(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            stripe_account: stripe.Account = event["data"]["object"]
            await account_service.update_account_from_stripe(
                session, stripe_account=stripe_account
            )


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(
    ctx: JobContext,
    event: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            payment_intent = event["data"]["object"]
            payload = PaymentIntentSuccessWebhook.model_validate(payment_intent)
            metadata = payment_intent.get("metadata", {})

            # Payment for Polar Checkout Session
            if (
                metadata.get("type") == ProductType.product
                and (checkout_id := metadata.get("checkout_id")) is not None
            ):
                await checkout_service.handle_stripe_success(
                    session, uuid.UUID(checkout_id), payment_intent
                )
                return

            # Check if there is a Stripe Checkout Session related,
            # meaning it's a product or subscription purchase
            checkout_session = (
                await stripe_service.get_checkout_session_by_payment_intent(payload.id)
            )
            if (
                checkout_session is not None
                and checkout_session.metadata is not None
                and checkout_session.metadata.get("type") == ProductType.product
            ):
                return

            # payments for pay_upfront (pi has metadata)
            if metadata.get("type") == ProductType.pledge:
                await pledge_service.handle_payment_intent_success(
                    session=session,
                    payload=payload,
                )
                return

            if metadata.get("type") == ProductType.donation:
                metadata = DonationPaymentIntentMetadata.model_validate(metadata)
                await donation_service.handle_payment_intent_success(
                    session=session,
                    payload=payload,
                    metadata=metadata,
                )
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


@task("stripe.webhook.payment_intent.payment_failed")
async def payment_intent_payment_failed(
    ctx: JobContext,
    event: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            payment_intent = event["data"]["object"]
            metadata = payment_intent.metadata or {}

            # Payment for Polar Checkout Session
            if (
                metadata.get("type") == ProductType.product
                and (checkout_id := metadata.get("checkout_id")) is not None
            ):
                await checkout_service.handle_stripe_failure(
                    session, uuid.UUID(checkout_id), payment_intent
                )


@task("stripe.webhook.charge.succeeded")
async def charge_succeeded(
    ctx: JobContext,
    event: dict[str, Any],  # stripe.Event
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            charge = event["data"]["object"]
            try:
                await payment_transaction_service.create_payment(
                    session=session, charge=charge
                )
            except (
                PaymentTransactionPledgeDoesNotExist,
                PaymentTransactionDonationDoesNotExist,
            ) as e:
                # Retry because we might not have been able to handle other events
                # triggering the creation of Pledge and Subscription
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(DELAY ** ctx["job_try"]) from e
                else:
                    raise


@task("stripe.webhook.charge.refunded")
async def charge_refunded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            charge = event["data"]["object"]

            await refund_transaction_service.create_refunds(session, charge=charge)

            if charge.metadata.get("type") == ProductType.pledge:
                await pledge_service.refund_by_payment_id(
                    session=session,
                    payment_id=charge["payment_intent"],
                    amount=charge["amount_refunded"],
                    transaction_id=charge["id"],
                )


@task("stripe.webhook.charge.dispute.created")
async def charge_dispute_created(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            dispute = event["data"]["object"]

            try:
                await dispute_transaction_service.create_dispute(
                    session, dispute=dispute
                )
            except DisputeUnknownPaymentTransaction as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle charge.succeeded yet!
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(DELAY ** ctx["job_try"]) from e
                else:
                    raise

            charge = await stripe_service.get_charge(dispute.charge)
            if charge.metadata.get("type") == ProductType.pledge:
                await pledge_service.mark_charge_disputed_by_payment_id(
                    session=session,
                    payment_id=dispute["payment_intent"],
                    amount=dispute["amount"],
                    transaction_id=dispute["id"],
                )


@task("stripe.webhook.charge.dispute.funds_reinstated")
async def charge_dispute_funds_reinstated(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            dispute = event["data"]["object"]

            await dispute_transaction_service.create_dispute_reversal(
                session, dispute=dispute
            )


@task("stripe.webhook.customer.subscription.created")
async def customer_subscription_created(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            subscription = stripe.Subscription.construct_from(
                event["data"]["object"], None
            )
            await subscription_service.create_subscription_from_stripe(
                session, stripe_subscription=subscription
            )


@task("stripe.webhook.customer.subscription.updated")
async def customer_subscription_updated(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            subscription = stripe.Subscription.construct_from(
                event["data"]["object"], None
            )
            try:
                await subscription_service.update_subscription_from_stripe(
                    session, stripe_subscription=subscription
                )
            except SubscriptionDoesNotExist as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(DELAY ** ctx["job_try"]) from e
                else:
                    raise


@task("stripe.webhook.customer.subscription.deleted")
async def customer_subscription_deleted(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            subscription = stripe.Subscription.construct_from(
                event["data"]["object"], None
            )
            try:
                await subscription_service.update_subscription_from_stripe(
                    session, stripe_subscription=subscription
                )
            except SubscriptionDoesNotExist as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(DELAY ** ctx["job_try"]) from e
                else:
                    raise


@task("stripe.webhook.invoice.paid")
async def invoice_paid(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            invoice = stripe.Invoice.construct_from(event["data"]["object"], None)
            try:
                await order_service.create_order_from_stripe(session, invoice=invoice)
            except (
                OrderSubscriptionDoesNotExist,
                PaymentTransactionForChargeDoesNotExist,
            ) as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created
                # or charge.succeeded yet!
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(DELAY ** ctx["job_try"]) from e
                else:
                    raise
            except NotAnOrderInvoice:
                # Ignore invoices that are not for orders (e.g. for pledges)
                return


@task("stripe.webhook.payout.paid")
async def payout_paid(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    if event.account is None:
        raise UnsetAccountOnPayoutEvent(event.id)
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            payout = event["data"]["object"]
            await payout_transaction_service.create_payout_from_stripe(
                session, payout=payout, stripe_account_id=event.account
            )
