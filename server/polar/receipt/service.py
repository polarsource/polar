import asyncio
from datetime import datetime

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.eventstream.service import publish as eventstream_publish
from polar.integrations.aws.s3 import S3Service
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Order
from polar.order.repository import OrderRepository
from polar.payment.repository import PaymentRepository
from polar.refund.repository import RefundRepository
from polar.worker import enqueue_job

from .generator import Receipt
from .render import render_receipt_pdf

RECEIPT_NUMBER_PREFIX = "RCPT"
# `private` keeps PII out of shared caches; the unique S3 key per render
# makes `immutable` safe for the browser cache.
RECEIPT_CACHE_CONTROL = "private, max-age=31536000, immutable"
# 120s covers the worst-case render+upload; 1s acquire window means a
# concurrent render triggers a retry rather than tying up workers.
RECEIPT_RENDER_LOCK_TIMEOUT = 120
RECEIPT_RENDER_LOCK_BLOCKING_TIMEOUT = 1


class ReceiptService:
    async def allocate(self, session: AsyncSession, order: Order) -> Order:
        """Allocate ``receipt_number`` for ``order``.

        Idempotent under concurrent calls: the row-level lock plus the
        post-lock null-check prevents double-allocation.
        """
        if order.receipt_number is not None:
            return order

        payment_repository = PaymentRepository.from_session(session)
        succeeded_payment = await payment_repository.get_succeeded_by_order(order.id)
        if succeeded_payment is None:
            return order

        order_repository = OrderRepository.from_session(session)
        current_number = await order_repository.lock_for_receipt_allocation(order.id)
        # Another transaction may have allocated between the null-check above
        # and this lock acquisition.
        if current_number is not None:
            order.receipt_number = current_number
            return order

        customer_repository = CustomerRepository.from_session(session)
        number = await customer_repository.increment_receipt_next_number(
            order.customer_id
        )
        order.receipt_number = (
            f"{RECEIPT_NUMBER_PREFIX}-{order.customer.short_id_str}-{number:04d}"
        )

        return order

    async def _create_order_receipt(self, session: AsyncSession, order: Order) -> str:
        """Render the receipt PDF and upload it to S3, returning the new key."""
        payment_repository = PaymentRepository.from_session(session)
        payment = await payment_repository.get_succeeded_by_order(order.id)
        payments = [payment] if payment is not None else []

        refund_repository = RefundRepository.from_session(session)
        refunds = list(await refund_repository.get_succeeded_by_order(order.id))

        receipt = Receipt.from_order(order, payments, refunds)
        pdf_bytes = await render_receipt_pdf(receipt)

        timestamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
        key = f"{order.organization_id}/{order.id}/{timestamp}.pdf"

        s3 = S3Service(settings.S3_CUSTOMER_RECEIPTS_BUCKET_NAME)
        await asyncio.to_thread(
            s3.upload,
            pdf_bytes,
            key,
            "application/pdf",
            cache_control=RECEIPT_CACHE_CONTROL,
        )
        return key

    async def generate_order_receipt(
        self, session: AsyncSession, locker: Locker, order: Order
    ) -> Order:
        """Render the receipt under a cross-process lock and persist
        ``Order.receipt_path``. Raises ``TimeoutLockError`` when another
        worker is already rendering — caller decides whether to retry.
        """
        if order.receipt_number is None:
            return order

        lock_name = f"receipt:render:{order.id}"
        async with locker.lock(
            lock_name,
            timeout=RECEIPT_RENDER_LOCK_TIMEOUT,
            blocking_timeout=RECEIPT_RENDER_LOCK_BLOCKING_TIMEOUT,
        ):
            key = await self._create_order_receipt(session, order)
            order_repository = OrderRepository.from_session(session)
            order = await order_repository.update(
                order, update_dict={"receipt_path": key}
            )
            await eventstream_publish(
                "order.receipt_generated",
                {"order_id": order.id},
                customer_id=order.customer_id,
                organization_id=order.organization_id,
            )
            return order

    async def get_pdf_url_or_status(self, order: Order) -> tuple[str, datetime] | None:
        if order.receipt_path is None:
            enqueue_job("receipt.render", order_id=order.id)
            return None

        s3 = S3Service(settings.S3_CUSTOMER_RECEIPTS_BUCKET_NAME)
        return s3.generate_presigned_download_url(
            path=order.receipt_path,
            filename=order.receipt_filename,
            mime_type="application/pdf",
        )


receipt = ReceiptService()
