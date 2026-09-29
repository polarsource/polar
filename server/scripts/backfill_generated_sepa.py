"""Repair generated SEPA methods, then reconcile explicitly selected unpaid orders.

    uv run python -m scripts.backfill_generated_sepa backfill
    uv run python -m scripts.backfill_generated_sepa backfill --execute
    uv run python -m scripts.backfill_generated_sepa recover-order ORDER_ID
    uv run python -m scripts.backfill_generated_sepa recover-order ORDER_ID --execute --retry

Both commands default to read-only. Deploy the resolver before running the backfill.
Recovery preserves processing intents and payment locks; inspect those separately.
"""

from uuid import UUID

import dramatiq
import stripe as stripe_lib
import typer
from sqlalchemy import update

from polar import tasks  # noqa: F401
from polar.enums import PaymentMode, PaymentProcessor
from polar.integrations.stripe import payment as stripe_payment
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Order, PaymentMethod, Subscription
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.payment_method.repository import PaymentMethodRepository
from polar.payment_method.service import GENERATED_SEPA_PAYMENT_METHOD_TYPES
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession, create_async_engine
from polar.redis import create_redis
from polar.worker import JobQueueManager
from scripts.helper import configure_script_console_logging, typer_async

cli = typer.Typer()


async def find_generated_method(
    original: PaymentMethod,
) -> stripe_lib.PaymentMethod | None:
    customer_id = original.customer.stripe_customer_id
    if customer_id is None:
        return None
    matches = []
    async for method in stripe_service.list_payment_methods(customer_id):
        if method.type != "sepa_debit":
            continue
        method = await stripe_lib.PaymentMethod.retrieve_async(
            method.id,
            expand=[
                "sepa_debit.generated_from.charge",
                "sepa_debit.generated_from.setup_attempt",
            ],
        )
        generated_from = method.sepa_debit.generated_from if method.sepa_debit else None
        if generated_from is None:
            continue
        source = generated_from.charge or generated_from.setup_attempt
        if source is None or isinstance(source, str):
            continue
        if (
            source.payment_method is not None
            and get_expandable_id(source.payment_method) == original.processor_id
            and source.customer is not None
            and get_expandable_id(source.customer) == customer_id
            and method.customer is not None
            and get_expandable_id(method.customer) == customer_id
        ):
            matches.append(method)
    if len(matches) != 1:
        return None
    return await stripe_service.get_payment_method(matches[0].id)


async def backfill_method(
    session: AsyncSession, original: PaymentMethod, *, execute: bool
) -> bool:
    generated = await find_generated_method(original)
    if generated is None:
        typer.echo(f"{original.id}: no unique attached generated SEPA method; skipped")
        return False
    typer.echo(f"{original.id}: {original.processor_id} -> {generated.id}")
    if not execute:
        return True

    replacement = await payment_method_service.upsert_from_stripe(
        session, original.customer, generated, flush=True
    )
    repository = PaymentMethodRepository.from_session(session)
    assert original.customer_id == replacement.customer_id
    await session.execute(
        update(Customer)
        .where(
            Customer.id == original.customer_id,
            Customer.default_payment_method_id == original.id,
        )
        .values(default_payment_method_id=replacement.id)
    )
    await session.execute(
        update(Subscription)
        .where(
            Subscription.customer_id == original.customer_id,
            Subscription.payment_method_id == original.id,
        )
        .values(payment_method_id=replacement.id)
    )
    await repository.soft_delete(original)
    return True


@cli.command()
@typer_async
async def backfill(execute: bool = False) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    try:
        async with sessionmaker() as scan_session:
            scan_repository = PaymentMethodRepository.from_session(scan_session)
            statement = (
                scan_repository.get_base_statement()
                .where(
                    PaymentMethod.processor == PaymentProcessor.stripe,
                    PaymentMethod.type.in_(GENERATED_SEPA_PAYMENT_METHOD_TYPES),
                )
                .options(*scan_repository.get_eager_options())
                .order_by(PaymentMethod.id)
            )
            async for candidate in scan_repository.stream(statement):
                async with sessionmaker() as session:
                    repository = PaymentMethodRepository.from_session(session)
                    original = await repository.get_by_id(
                        candidate.id,
                        options=repository.get_eager_options(),
                        for_update=True,
                    )
                    if original is None:
                        continue
                    await backfill_method(session, original, execute=execute)
                    if execute:
                        await session.commit()
    finally:
        await engine.dispose()


async def recover_order(
    session: AsyncSession, order: Order, *, execute: bool, retry: bool
) -> None:
    if order.status != OrderStatus.pending or order.stripe_invoice_id is not None:
        typer.echo(f"{order.id}: not a pending Polar-billed order; skipped")
        return
    customer_id = order.customer.stripe_customer_id
    if customer_id is None:
        typer.echo(f"{order.id}: no Stripe customer; skipped")
        return

    intents = await stripe_lib.PaymentIntent.list_async(customer=customer_id, limit=100)
    matching = [
        intent
        async for intent in intents.auto_paging_iter()
        if intent.metadata.get("order_id") == str(order.id)
        or (
            order.checkout_id is not None
            and intent.metadata.get("checkout_id") == str(order.checkout_id)
        )
    ]
    for intent in matching:
        if intent.status == "succeeded":
            if (
                intent.amount_received != order.due_amount
                or intent.currency != order.currency
            ):
                typer.echo(
                    f"{order.id}: succeeded payment amount differs; manual reconciliation required"
                )
                return
            typer.echo(f"{order.id}: reconcile succeeded intent {intent.id}")
            if execute:
                assert intent.latest_charge is not None
                charge = await stripe_service.get_charge(
                    get_expandable_id(intent.latest_charge)
                )
                await stripe_payment.handle_success(session, charge)
            return
    if any(
        intent.status not in ("canceled", "requires_payment_method")
        for intent in matching
    ):
        typer.echo(
            f"{order.id}: existing payment is processing or needs action; skipped"
        )
        return
    if order.payment_lock_acquired_at is not None:
        typer.echo(f"{order.id}: payment lock is held; skipped")
        return

    method_id = (
        order.subscription.payment_method_id if order.subscription is not None else None
    ) or order.customer.default_payment_method_id
    repository = PaymentMethodRepository.from_session(session)
    method = (
        await repository.get_by_id_and_customer(method_id, order.customer_id)
        if method_id is not None
        else None
    )
    if method is None or method.type != "sepa_debit":
        typer.echo(f"{order.id}: no saved SEPA method; skipped")
        return
    if any(
        intent.payment_method is not None
        and get_expandable_id(intent.payment_method) == method.processor_id
        for intent in matching
    ):
        typer.echo(f"{order.id}: SEPA was already attempted; manual review required")
        return
    typer.echo(
        f"{order.id}: retry {order.due_amount} {order.currency} with {method.processor_id}"
    )
    if not (execute and retry):
        return
    stripe_method = await stripe_service.get_payment_method(method.processor_id)
    if (
        stripe_method.type != "sepa_debit"
        or stripe_method.customer is None
        or get_expandable_id(stripe_method.customer) != customer_id
    ):
        typer.echo(f"{order.id}: SEPA method is not attached to this customer; skipped")
        return
    for intent in matching:
        if intent.status != "canceled":
            await stripe_service.cancel_payment_intent(intent.id)
    retry_intent = await order_service.trigger_payment(
        session,
        order,
        method,
        payment_mode=PaymentMode.sync,
        payment_trigger=PaymentTrigger.retry_payment_method_update,
    )
    if retry_intent is not None:
        typer.echo(f"{order.id}: {retry_intent.id} {retry_intent.status}")
        if retry_intent.status == "succeeded":
            assert retry_intent.latest_charge is not None
            charge = await stripe_service.get_charge(
                get_expandable_id(retry_intent.latest_charge)
            )
            await stripe_payment.handle_success(session, charge)


@cli.command("recover-order")
@typer_async
async def recover_order_command(
    order_id: UUID, execute: bool = False, retry: bool = False
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    try:
        async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
            async with sessionmaker() as session:
                repository = OrderRepository.from_session(session)
                order = await repository.get_by_id(
                    order_id, options=repository.get_eager_options(), for_update=True
                )
                if order is None:
                    raise typer.BadParameter("Order not found")
                await recover_order(session, order, execute=execute, retry=retry)
                if execute:
                    await session.commit()
                else:
                    manager.reset()
    finally:
        await redis.close()
        await engine.dispose()


if __name__ == "__main__":
    configure_script_console_logging()
    cli()
