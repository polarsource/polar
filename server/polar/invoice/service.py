from datetime import datetime

from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.aws.s3 import S3Service
from polar.kit.tax import TaxabilityReason
from polar.kit.utils import utc_now
from polar.models import Account, Order, Payout
from polar.models.transaction import PlatformFeeType
from polar.postgres import AsyncSession
from polar.transaction.repository import TransactionRepository

from .generator import (
    Invoice,
    InvoiceGenerator,
    InvoiceHeadingItem,
    InvoiceItem,
    InvoiceTotalsItem,
)


class InvoiceError(PolarError): ...


class MissingAccountBillingDetails(InvoiceError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = (
            "You must provide billing details for the account to generate an invoice."
        )
        super().__init__(message, 400)


class InvoiceService:
    async def create_order_invoice(self, order: Order) -> str:
        invoice = Invoice.from_order(order)
        generator = InvoiceGenerator(invoice)
        generator.generate()
        invoice_bytes = generator.output()

        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        return s3.upload(
            bytes(invoice_bytes), order.invoice_filename, "application/pdf"
        )

    async def get_order_invoice_url(self, order: Order) -> tuple[str, datetime]:
        invoice_path = order.invoice_path
        assert invoice_path is not None
        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        return s3.generate_presigned_download_url(
            path=invoice_path,
            filename=order.invoice_filename,
            mime_type="application/pdf",
        )

    async def create_payout_invoice(self, session: AsyncSession, payout: Payout) -> str:
        account = payout.account
        if account.billing_name is None or account.billing_address is None:
            raise MissingAccountBillingDetails(account)

        transaction_repository = TransactionRepository.from_session(session)
        payout_transactions = (
            await transaction_repository.get_all_paid_transactions_by_payout(
                payout.transaction.id
            )
        )
        earliest = payout_transactions[0].created_at
        latest = payout_transactions[-1].created_at

        gross_amount = 0
        payment_fees_amount = 0
        payout_fees_amount = 0
        for transaction in payout_transactions:
            if transaction.platform_fee_type is None:
                gross_amount += transaction.amount
            elif transaction.platform_fee_type not in {
                PlatformFeeType.account,
                PlatformFeeType.payout,
                PlatformFeeType.cross_border_transfer,
            }:
                payment_fees_amount += transaction.amount
            else:
                payout_fees_amount += transaction.amount

        # Sanity check to make sure the amounts add up correctly
        assert payout.fees_amount == abs(payout_fees_amount)
        assert payout.amount == gross_amount + payout_fees_amount + payment_fees_amount
        assert payout.paid_at is not None

        invoice = Invoice(
            number=payout.invoice_number,
            date=utc_now(),
            seller_name=account.billing_name,
            seller_address=account.billing_address,
            seller_additional_info=account.billing_additional_info,
            customer_name=settings.INVOICES_NAME,
            customer_address=settings.INVOICES_ADDRESS,
            customer_additional_info=settings.INVOICES_ADDITIONAL_INFO,
            subtotal_amount=payout.amount,
            discount_amount=0,
            taxability_reason=TaxabilityReason.product_exempt,
            tax_amount=0,
            tax_rate=None,
            currency=payout.currency,
            items=[
                InvoiceItem(
                    description=f"Digital services and products resold by Polar.sh\nFrom {earliest.strftime('%Y-%m-%d')} to {latest.strftime('%Y-%m-%d')}",
                    quantity=1,
                    unit_amount=gross_amount,
                    amount=gross_amount,
                ),
                InvoiceItem(
                    description="Polar revenue share",
                    quantity=1,
                    unit_amount=payment_fees_amount,
                    amount=payment_fees_amount,
                ),
                InvoiceItem(
                    description="Payout fees",
                    quantity=1,
                    unit_amount=payout_fees_amount,
                    amount=payout_fees_amount,
                ),
            ],
            notes=(f"{account.billing_notes}\n\n" if account.billing_notes else "")
            + (
                "Polar Software, Inc. is the merchant of record reselling digital services.\n"
                "Polar Software, Inc. captures and remits international sales tax from such sales – as needed.\n"
                "Payouts (reverse invoices) are therefore without taxes."
            ),
            extra_heading_items=[
                InvoiceHeadingItem(label="Paid at", value=payout.paid_at),
                InvoiceHeadingItem(
                    label="Payout Method", value=payout.processor.get_display_name()
                ),
                InvoiceHeadingItem(label="Payout ID", value=str(payout.id)),
            ],
            extra_totals_items=[
                InvoiceTotalsItem(
                    label="Payout Amount",
                    amount=payout.account_amount,
                    currency=payout.account_currency,
                )
            ]
            if payout.account_currency != payout.currency
            else [],
        )

        generator = InvoiceGenerator(invoice, heading_title="Reverse Invoice")
        generator.generate()
        invoice_bytes = generator.output()
        s3 = S3Service(settings.S3_PAYOUT_INVOICES_BUCKET_NAME)
        return s3.upload(
            bytes(invoice_bytes),
            f"{account.id}/Payout-{payout.invoice_number}.pdf",
            "application/pdf",
        )

    async def get_payout_invoice_url(self, payout: Payout) -> tuple[str, datetime]:
        invoice_path = payout.invoice_path
        assert invoice_path is not None
        filename = f"Payout-{payout.invoice_number}.pdf"
        s3 = S3Service(settings.S3_PAYOUT_INVOICES_BUCKET_NAME)
        return s3.generate_presigned_download_url(
            path=invoice_path, filename=filename, mime_type="application/pdf"
        )


invoice = InvoiceService()
