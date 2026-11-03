import uuid

import stripe as stripe_lib
import structlog

from polar.checkout.repository import CheckoutRepository
from polar.checkout.service import NotConfirmedCheckout
from polar.checkout.service import checkout as checkout_service
from polar.exceptions import PolarError
from polar.integrations.stripe.service import (
    STRIPE_METADATA_PAYMENT_TRIGGER,
)
from polar.integrations.stripe.service import (
    stripe as stripe_service,
)
from polar.integrations.stripe.utils import get_expandable_id
from polar.logging import Logger
from polar.models import (
    Checkout,
    Order,
    Organization,
    Payment,
    PaymentMethod,
    Wallet,
    WalletTransaction,
)
from polar.models.checkout import CheckoutStatus
from polar.models.payment import DUNNING_COUNTING_TRIGGERS, PaymentTrigger
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.organization.repository import OrganizationRepository
from polar.payment.service import payment as payment_service
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncSession
from polar.wallet.repository import WalletRepository, WalletTransactionRepository
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()


class OrderDoesNotExist(PolarError):
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        message = f"Order with id {order_id} does not exist."
        super().__init__(message)


class UnresolvedPaymentError(PolarError):
    def __init__(self, processor_id: str) -> None:
        self.processor_id = processor_id
        message = (
            f"Received a payment with id {processor_id} that can't be resolved to "
            "an organization."
        )
        super().__init__(message)


async def _resolve_organization(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> Organization | None:
    if object.metadata is None:
        return None

    if (organization_id := object.metadata.get("organization_id")) is None:
        log.warning(
            "Legacy payment resolution: no organization_id in metadata",
            object_id=object.id,
        )
        if checkout := await resolve_checkout(session, object):
            return checkout.organization
        if order := await resolve_order(session, object, checkout=None):
            return order.organization
        wallet, _ = await resolve_wallet(session, object)
        if wallet:
            return wallet.organization

    repository = OrganizationRepository.from_session(session)
    return await repository.get_by_id(
        uuid.UUID(organization_id), include_deleted=True, include_blocked=True
    )


async def resolve_organization(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> Organization:
    organization = await _resolve_organization(session, object)
    if organization is None:
        raise UnresolvedPaymentError(object.id)
    return organization


async def resolve_checkout(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> Checkout | None:
    if object.metadata is None:
        return None

    if (checkout_id := object.metadata.get("checkout_id")) is None:
        return None

    repository = CheckoutRepository.from_session(session)
    return await repository.get_by_id(
        uuid.UUID(checkout_id), options=repository.get_eager_options(), for_update=True
    )


async def resolve_wallet(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> tuple[Wallet | None, WalletTransaction | None]:
    if object.metadata is None:
        return None, None

    wallet_id = object.metadata.get("wallet_id")
    wallet_transaction_id = object.metadata.get("wallet_transaction_id")

    if wallet_transaction_id is not None:
        wallet_transaction_repository = WalletTransactionRepository.from_session(
            session
        )
        wallet_transaction = await wallet_transaction_repository.get_by_id(
            uuid.UUID(wallet_transaction_id),
            options=wallet_transaction_repository.get_eager_options(),
        )
        if wallet_transaction is not None:
            return wallet_transaction.wallet, wallet_transaction

    if wallet_id is not None:
        wallet_repository = WalletRepository.from_session(session)
        wallet = await wallet_repository.get_by_id(
            uuid.UUID(wallet_id), options=wallet_repository.get_eager_options()
        )
        return wallet, None

    return None, None


async def resolve_order(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
    checkout: Checkout | None,
) -> Order | None:
    order_repository = OrderRepository.from_session(session)
    if (
        object.metadata is not None
        and (order_id := object.metadata.get("order_id")) is not None
    ):
        order = await order_repository.get_by_id(
            uuid.UUID(order_id), options=order_repository.get_eager_options()
        )
        if order is None:
            payment_intent_id: str | None = None
            if object.OBJECT_NAME == "payment_intent":
                payment_intent_id = object.id
            elif object.OBJECT_NAME == "charge" and isinstance(
                object.payment_intent, str
            ):
                payment_intent_id = object.payment_intent
            if payment_intent_id is not None:
                updated_intent = await stripe_service.get_payment_intent(
                    payment_intent_id
                )
                if (
                    updated_intent.metadata
                    and updated_intent.metadata.get("polar_failed_sync_payment")
                    == "true"
                ):
                    return None
            raise OrderDoesNotExist(order_id)
        return order

    if checkout is not None:
        return await order_repository.get_earliest_by_checkout_id(
            checkout.id, options=order_repository.get_eager_options()
        )

    return None


def _resolve_trigger(
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> PaymentTrigger | None:
    if object.metadata is None:
        return None
    raw = object.metadata.get(STRIPE_METADATA_PAYMENT_TRIGGER)
    if raw is not None:
        try:
            return PaymentTrigger(raw)
        except ValueError:
            log.warning(
                "Unknown payment_trigger value in Stripe metadata",
                object_id=object.id,
                raw_trigger=raw,
            )
    if object.metadata.get("checkout_id") is not None:
        return PaymentTrigger.purchase
    return None


async def handle_success(
    session: AsyncSession, object: stripe_lib.Charge | stripe_lib.SetupIntent
) -> None:
    organization = await resolve_organization(session, object)
    checkout = await resolve_checkout(session, object)
    wallet, wallet_transaction = await resolve_wallet(session, object)
    order = await resolve_order(session, object, checkout)

    trigger = _resolve_trigger(object)

    payment: Payment | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, organization, checkout, wallet, order, trigger=trigger
        )

    if checkout is not None:
        if object.OBJECT_NAME == "setup_intent":
            checkout_intent_client_secret = checkout.payment_processor_metadata.get(
                "intent_client_secret"
            )
            if checkout.status == CheckoutStatus.expired or (
                checkout_intent_client_secret is not None
                and object.client_secret != checkout_intent_client_secret
            ):
                log.info(
                    "Skipping outdated checkout intent",
                    checkout_id=checkout.id,
                    intent_id=object.id,
                )
                return

            # Metadata marker is set when confirmation was denied because of trial abuse detection
            if checkout.status == CheckoutStatus.open:
                updated_object = await stripe_service.get_setup_intent(object.id)
                if (
                    updated_object.metadata
                    and updated_object.metadata.get("polar_trial_abuse_detected")
                    == "true"
                ):
                    log.info(
                        "Skipping outdated checkout intent after trial abuse detection",
                        checkout_id=checkout.id,
                        intent_id=object.id,
                    )
                    return

        if checkout.status not in {CheckoutStatus.confirmed, CheckoutStatus.succeeded}:
            raise NotConfirmedCheckout(checkout)

        payment_method: PaymentMethod | None = None
        if checkout.should_save_payment_method:
            payment_method = await payment_method_service.upsert_from_stripe_intent(
                session, object, checkout
            )
            await session.flush()

        enqueue_job(
            "checkout.success",
            checkout_id=checkout.id,
            payment_id=payment.id if payment is not None else None,
            payment_method_id=payment_method.id if payment_method is not None else None,
        )

    if order is not None:
        enqueue_job(
            "order.paid",
            order_id=order.id,
            payment_id=payment.id if payment is not None else None,
        )

    if wallet_transaction is not None:
        enqueue_job(
            "order.wallet_order",
            wallet_transaction_id=wallet_transaction.id,
            payment_id=payment.id if payment is not None else None,
        )


async def handle_failure(
    session: AsyncSession,
    object: stripe_lib.Charge | stripe_lib.PaymentIntent | stripe_lib.SetupIntent,
) -> None:
    organization = await resolve_organization(session, object)
    checkout = await resolve_checkout(session, object)
    wallet, _ = await resolve_wallet(session, object)
    order = await resolve_order(session, object, checkout)

    trigger = _resolve_trigger(object)

    payment: Payment | None = None
    intent_id: str | None = None
    if object.OBJECT_NAME == "charge":
        payment = await payment_service.upsert_from_stripe_charge(
            session, object, organization, checkout, wallet, order, trigger=trigger
        )
        intent_id = (
            get_expandable_id(object.payment_intent) if object.payment_intent else None
        )
    elif object.OBJECT_NAME == "payment_intent":
        payment = await payment_service.upsert_from_stripe_payment_intent(
            session, object, organization, checkout, order, trigger=trigger
        )
        intent_id = object.id
    elif object.OBJECT_NAME == "setup_intent":
        intent_id = object.id

    if checkout is not None:
        current_intent_id = checkout.payment_processor_metadata.get("intent_id")
        if (
            current_intent_id is None
            or intent_id is None
            or current_intent_id == intent_id
        ):
            await checkout_service.handle_failure(session, checkout, payment=payment)

    if order is not None:
        # Failures from triggers that don't count toward the dunning ceiling
        # also shouldn't progress the dunning state machine — otherwise a
        # one-shot recovery attempt (manual portal retry, post-card-update
        # retry) could push the next scheduled retry around without ever
        # being recorded as a real attempt. A NULL trigger (legacy / unknown
        # call site) is treated as countable, so it follows the normal flow.
        skip_dunning = trigger is not None and trigger not in DUNNING_COUNTING_TRIGGERS
        await order_service.handle_payment_failure(
            session, order, skip_dunning=skip_dunning
        )


__all__ = [
    "handle_failure",
    "handle_success",
    "resolve_checkout",
    "resolve_order",
]
