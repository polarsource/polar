import math
from typing import Literal
from uuid import UUID

import stripe as stripe_lib
import structlog

from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
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
        self, payment_id: str | UUID, payment_type: Literal["charge", "order", "pledge"]
    ) -> None:
        self.payment_id = payment_id
        message = f"Refund issued for unknown {payment_type}: {payment_id}"
        super().__init__(message)


class RefundService(ResourceServiceReader[Refund]):
    async def upsert_from_stripe_charge(
        self, session: AsyncSession, charge: stripe_lib.Charge
    ) -> tuple[list[Refund], list[Refund]]:
        payment_transaction = await payment_transaction_service.get_by(
            session, charge_id=charge.id
        )
        if payment_transaction is None:
            raise RefundUnknownPayment(charge.id, payment_type="charge")

        order = None
        pledge = None
        if payment_transaction.order_id:
            order = await order_service.get(
                session, payment_transaction.order_id, allow_deleted=True
            )
            if not order:
                raise RefundUnknownPayment(
                    payment_transaction.order_id, payment_type="order"
                )
        elif payment_transaction.pledge_id:
            pledge = await pledge_service.get_by_payment_id(
                session,
                payment_id=charge["payment_intent"],
            )
            if pledge is None:
                raise RefundUnknownPayment(
                    payment_transaction.pledge_id, payment_type="pledge"
                )

        # Get all the refunds for this charge
        refunds = await stripe_service.list_refunds(charge=charge.id)

        created: list[Refund] = []
        updated: list[Refund] = []

        # Handle each individual refund
        async for refund in refunds:
            if refund.status != "succeeded":
                continue

            # Already handled that refund before
            existing_refund = await self.get_by(session, stripe_id=refund.id)
            if existing_refund is not None:
                updated.append(existing_refund)
                continue

            refund_amount = refund.amount
            total_amount = payment_transaction.amount + payment_transaction.tax_amount
            tax_refund_amount = abs(
                int(
                    math.floor(payment_transaction.tax_amount * refund_amount)
                    / total_amount
                )
            )

            failure_reason = failure_reason_from_stripe(
                getattr(refund, "failure_reason", None)
            )

            new_refund = Refund(
                status=refund.status,
                reason=reason_from_stripe(refund.reason),
                amount=refund.amount - tax_refund_amount,
                tax_amount=tax_refund_amount,
                currency=refund.currency,
                failure_reason=failure_reason,
                destination_details=refund.destination_details,
                stripe_id=refund.id,
                stripe_receipt_number=refund.receipt_number,
                stripe_reason=refund.reason,
                order=order,
                pledge=pledge,
            )

            log.info(
                "refund.create",
                id=new_refund.id,
                amount=new_refund.amount,
                tax_amount=new_refund.tax_amount,
                order_id=new_refund.order_id,
                reason=new_refund.reason,
                stripe_id=new_refund.stripe_id,
            )
            session.add(new_refund)
            created.append(new_refund)
            await refund_transaction_service.create(
                session,
                charge_id=charge.id,
                payment_transaction=payment_transaction,
                refund=new_refund,
            )
            await session.flush()

        instances = created[:]
        instances.extend(updated)
        if order is not None:
            await order_service.refund(session, order=order, refunds=instances)
        elif pledge is not None:
            await pledge_service.refund_by_payment_id(
                session=session,
                payment_id=charge["payment_intent"],
                amount=charge["amount_refunded"],
                transaction_id=charge["id"],
            )

        await session.flush()
        return (created, updated)


refund = RefundService(Refund)
