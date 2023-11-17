import stripe
from arq import Retry
from pydantic import parse_obj_as

from polar.integrations.stripe.schemas import PaymentIntentSuccessWebhook
from polar.pledge.service import pledge as pledge_service
from polar.subscription.service.subscription import SubscriptionDoesNotExist
from polar.subscription.service.subscription import subscription as subscription_service
from polar.transaction.service import (
    SubscriptionDoesNotExist as TransactionSubscriptionDoesNotExist,
)
from polar.transaction.service import transaction as transaction_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task


@task("stripe.webhook.payment_intent.succeeded")
async def payment_intent_succeeded(
    ctx: JobContext, event: stripe.Event, polar_context: PolarWorkerContext
) -> None:
    with polar_context.to_execution_context():
        async with AsyncSessionMaker(ctx) as session:
            payment_intent = event["data"]["object"]
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
                await transaction_service.stripe_handle_payment(
                    session=session, charge=charge
                )
            except TransactionSubscriptionDoesNotExist as e:
                # Retry because Stripe webhooks order is not guaranteed,
                # so we might not have been able to handle subscription.created yet!
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
            await pledge_service.mark_charge_disputed_by_payment_id(
                session=session,
                payment_id=dispute["payment_intent"],
                amount=dispute["amount"],
                transaction_id=dispute["id"],
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
