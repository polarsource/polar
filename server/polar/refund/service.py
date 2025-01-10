import math
from typing import Literal, TypeAlias
from uuid import UUID

import stripe as stripe_lib
import structlog

from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import Order, Pledge, Transaction
from polar.models.refund import Refund, failure_reason_from_stripe, reason_from_stripe
from polar.order.service import order as order_service
from polar.pledge.service import pledge as pledge_service
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)

log: Logger = structlog.get_logger()


class RefundError(PolarError): ...


class RefundUnknownPayment(RefundError):
    def __init__(
        self, id: str | UUID, payment_type: Literal["charge", "order", "pledge"]
    ) -> None:
        self.id = id
        message = f"Refund issued for unknown {payment_type}: {id}"
        super().__init__(message)


ChargeID: TypeAlias = str
RefundTransaction: TypeAlias = Transaction
RefundedResources: TypeAlias = tuple[
    ChargeID, RefundTransaction, Order | None, Pledge | None
]
Created: TypeAlias = bool

RefundAmount: TypeAlias = int
RefundTaxAmount: TypeAlias = int
FullRefund: TypeAlias = bool


class RefundService(ResourceServiceReader[Refund]):
    async def create_from_stripe(
        self, session: AsyncSession, stripe_refund: stripe_lib.Refund
    ) -> Refund:
        resources = await self._get_resources_from_stripe_refund(session, stripe_refund)
        charge_id, payment, order, pledge = resources

        instance = self.build_instance_from_stripe(
            stripe_refund,
            payment=payment,
            order=order,
            pledge=pledge,
        )
        session.add(instance)
        await refund_transaction_service.create(
            session,
            charge_id=charge_id,
            payment_transaction=payment,
            refund=instance,
        )
        await session.flush()
        # TODO: Webhooks on refund.created
        log.info(
            "refund.create",
            id=instance.id,
            amount=instance.amount,
            tax_amount=instance.tax_amount,
            order_id=instance.order_id,
            reason=instance.reason,
            stripe_id=instance.stripe_id,
        )
        return instance

    async def update_from_stripe(
        self, session: AsyncSession, stripe_refund: stripe_lib.Refund
    ) -> Refund:
        refund = await self.get_by(session, stripe_id=stripe_refund.id)
        if not refund:
            return await self.create_from_stripe(session, stripe_refund)

        resources = await self._get_resources_from_stripe_refund(session, stripe_refund)
        charge_id, payment, order, pledge = resources
        updated = self.build_instance_from_stripe(
            stripe_refund,
            payment=payment,
            order=order,
            pledge=pledge,
        )

        refund_succeeded_before_update = refund.succeeded

        # Reference: https://docs.stripe.com/refunds#see-also
        # Only `metadata` and `destination_details` should update according to
        # docs, but a pending refund can surely become `succeeded`, `canceled` or `failed`
        refund.status = updated.status
        refund.failure_reason = updated.failure_reason
        refund.destination_details = updated.destination_details
        refund.stripe_receipt_number = updated.stripe_receipt_number
        refund.set_modified()
        session.add(refund)

        log.info(
            "refund.updated",
            id=refund.id,
            amount=refund.amount,
            tax_amount=refund.tax_amount,
            order_id=refund.order_id,
            reason=refund.reason,
            stripe_id=refund.stripe_id,
        )

        # TODO: Possible for the reverse, i.e need to reverse refund?
        if not refund_succeeded_before_update and refund.succeeded:
            await refund_transaction_service.create(
                session,
                charge_id=charge_id,
                payment_transaction=payment,
                refund=refund,
            )
            # TODO: Webhooks on refund.update

        await session.flush()
        return refund

    async def handle_refunded_stripe_charge(
        self, session: AsyncSession, charge: stripe_lib.Charge
    ) -> None:
        _, payment, order, pledge = await self._get_resources_from_stripe_charge(
            session, charge
        )

        stripe_amount = charge.amount_refunded
        refunded_amount, refunded_tax_amount, _ = self.calculate_stripe_refund_amounts(
            stripe_amount, payment
        )

        if order is not None:
            await order_service.set_refunded(
                session,
                order,
                refunded_amount=refunded_amount,
                refunded_tax_amount=refunded_tax_amount,
            )
        elif pledge is not None:
            await pledge_service.refund_by_payment_id(
                session=session,
                payment_id=charge["payment_intent"],
                amount=charge["amount_refunded"],
                transaction_id=charge["id"],
            )

        # TODO: Webhook for order.refunded

    def calculate_stripe_refund_amounts(
        self, stripe_amount: int, payment: Transaction
    ) -> tuple[RefundAmount, RefundTaxAmount, FullRefund]:
        total_amount = payment.amount + payment.tax_amount
        refunded_tax_amount = abs(
            int(math.floor(payment.tax_amount * stripe_amount) / total_amount)
        )
        refunded_amount = stripe_amount - refunded_tax_amount

        full_refund = (
            refunded_amount == payment.amount
            and refunded_tax_amount == payment.tax_amount
        )
        return refunded_amount, refunded_tax_amount, full_refund

    def build_instance_from_stripe(
        self,
        stripe_refund: stripe_lib.Refund,
        *,
        payment: Transaction,
        order: Order | None = None,
        pledge: Pledge | None = None,
    ) -> Refund:
        refunded_amount, refunded_tax_amount, _ = self.calculate_stripe_refund_amounts(
            stripe_refund.amount, payment
        )

        failure_reason = failure_reason_from_stripe(
            getattr(stripe_refund, "failure_reason", None)
        )

        stripe_reason = stripe_refund.reason if stripe_refund.reason else "other"

        instance = Refund(
            status=stripe_refund.status,
            reason=reason_from_stripe(stripe_refund.reason),
            amount=refunded_amount,
            tax_amount=refunded_tax_amount,
            currency=stripe_refund.currency,
            failure_reason=failure_reason,
            destination_details=stripe_refund.destination_details,
            stripe_id=stripe_refund.id,
            stripe_receipt_number=stripe_refund.receipt_number,
            stripe_reason=stripe_reason,
            order=order,
            pledge=pledge,
        )
        return instance

    async def _get_resources_from_stripe_refund(
        self, session: AsyncSession, refund: stripe_lib.Refund
    ) -> RefundedResources:
        if not refund.charge:
            raise RefundUnknownPayment(refund.id, payment_type="charge")

        payment_intent = str(refund.payment_intent) if refund.payment_intent else None
        return await self._get_resources(session, str(refund.charge), payment_intent)

    async def _get_resources_from_stripe_charge(
        self, session: AsyncSession, charge: stripe_lib.Charge
    ) -> RefundedResources:
        payment_intent = str(charge.payment_intent) if charge.payment_intent else None
        return await self._get_resources(session, str(charge.id), payment_intent)

    async def _get_resources(
        self, session: AsyncSession, charge_id: str, payment_intent: str | None
    ) -> RefundedResources:
        payment = await payment_transaction_service.get_by_charge_id(session, charge_id)
        if payment is None:
            raise RefundUnknownPayment(charge_id, payment_type="charge")

        if payment.order_id:
            order = await order_service.get(
                session, payment.order_id, allow_deleted=True
            )
            if not order:
                raise RefundUnknownPayment(payment.order_id, payment_type="order")

            return (charge_id, payment, order, None)

        if not (payment.pledge_id and payment_intent):
            raise RefundUnknownPayment(payment.id, payment_type="charge")

        pledge = await pledge_service.get_by_payment_id(
            session,
            payment_id=payment_intent,
        )
        if pledge is None:
            raise RefundUnknownPayment(payment.pledge_id, payment_type="pledge")

        return (charge_id, payment, None, pledge)


refund = RefundService(Refund)
