from datetime import datetime

from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.aws.s3 import S3Service
from polar.models import Order

from .generator import Invoice, InvoiceGenerator


class InvoiceError(PolarError): ...


class InvoiceService:
    async def create_order_invoice(self, order: Order) -> str:
        invoice = Invoice.from_order(order)
        generator = InvoiceGenerator(invoice)
        generator.generate()
        invoice_bytes = generator.output()

        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        return s3.upload(
            bytes(invoice_bytes), f"Invoice-{invoice.number}.pdf", "application/pdf"
        )

    async def get_order_invoice_url(self, order: Order) -> tuple[str, datetime]:
        invoice_path = order.invoice_path
        assert invoice_path is not None
        filename = f"Invoice-{order.invoice_number}.pdf"
        s3 = S3Service(settings.S3_CUSTOMER_INVOICES_BUCKET_NAME)
        return s3.generate_presigned_download_url(
            path=invoice_path, filename=filename, mime_type="application/pdf"
        )


invoice = InvoiceService()
