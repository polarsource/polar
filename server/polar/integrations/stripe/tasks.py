import stripe
from arq import Retry
from pydantic import parse_obj_as

from polar.exceptions import PolarError
from polar.integrations.stripe.schemas import (
    PaymentIntentSuccessWebhook,
    ProductType,
)
from polar.pledge.service import pledge as pledge_service
from polar.subscription.service.subscription import SubscriptionDoesNotExist
from polar.subscription.service.subscription import subscription as subscription_service
from polar.transaction.service.dispute import (
    DisputeUnknownPaymentTransaction,
)
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)
from polar.transaction.service.payment import (
    PledgeDoesNotExist as PaymentTransactionPledgeDoesNotExist,
)
from polar.transaction.service.payment import (
    SubscriptionDoesNotExist as PaymentTransactionSubscriptionDoesNotExist,
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


class StripeTaskError(PolarError):
    ...


class UnsetAccountOnPayoutEvent(StripeTaskError):
    def __init__(self, event_id: str) -> None:
        self.event_id = event_id
        message = (
            f"Received the payout.paid event {event_id}, "
            "but the connected account is not set"
        )
        super().__init__(message)


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            payment_intent = event["data"]["object"]
            if payment_intent.metadata.get("type") == ProductType.pledge:
                payload = parse_obj_as(PaymentIntentSuccessWebhook, payment_intent)
                await pledge_service.handle_payment_intent_success(
                    session=session,
                    payload=payload,
                )


@task("stripe.webhook.charge.succeeded")
async def charge_succeeded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
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
                PaymentTransactionSubscriptionDoesNotExist,
            ) as e:
                # Retry because we might not have been able to handle other events
                # triggering the creation of Pledge and Subscription
                MAX_RETRIES = 2
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(2 ** ctx["job_try"]) from e
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
                MAX_RETRIES = 2
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(2 ** ctx["job_try"]) from e
                else:
                    raise

            charge = stripe_service.get_charge(dispute.charge)
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
                session=session, payout=payout, stripe_account_id=event.account
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
            await subscription_service.create_subscription(
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
                await subscription_service.update_subscription(
                    session, stripe_subscription=subscription
                )
            except SubscriptionDoesNotExist as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                MAX_RETRIES = 2
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(2 ** ctx["job_try"]) from e
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
                await subscription_service.transfer_subscription_paid_invoice(
                    session, invoice=invoice
                )
            except SubscriptionDoesNotExist as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
                MAX_RETRIES = 2
                if ctx["job_try"] <= MAX_RETRIES:
                    raise Retry(2 ** ctx["job_try"]) from e
                else:
                    raise
