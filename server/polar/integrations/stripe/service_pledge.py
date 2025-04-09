from typing import Literal
from uuid import UUID

import stripe as stripe_lib

from polar.config import settings
from polar.integrations.stripe.schemas import (
    PledgePaymentIntentMetadata,
    ProductType,
)
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.postgres import AsyncSession

from .service import stripe as stripe_service

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class PledgeStripeService:
    async def modify_intent(
        self,
        id: str,
        amount: int,
        receipt_email: str,
        setup_future_usage: Literal["off_session", "on_session"] | None,
        on_behalf_of_organization_id: UUID | None = None,
    ) -> stripe_lib.PaymentIntent:
        metadata = PledgePaymentIntentMetadata(
            on_behalf_of_organization_id=on_behalf_of_organization_id
            if on_behalf_of_organization_id
            else "",  # Set to empty string to unset the value on Stripe.
        )

        return await stripe_lib.PaymentIntent.modify_async(
            id,
            amount=amount,
            receipt_email=receipt_email,
            setup_future_usage=setup_future_usage if setup_future_usage else "",
            metadata=metadata.model_dump(exclude_none=True),
        )

    async def create_user_pledge_invoice(
        self, session: AsyncSession, user: User, pledge: Pledge
    ) -> stripe_lib.Invoice | None:
        customer = await stripe_service.get_or_create_user_customer(session, user)
        if not customer:
            return None

        # Sync user email
        if not customer.email or customer.email != user.email:
            await stripe_lib.Customer.modify_async(
                customer.id,
                email=user.email,
            )

        return await self.create_pledge_invoice(customer, pledge)

    async def create_pledge_invoice(
        self, customer: stripe_lib.Customer, pledge: Pledge
    ) -> stripe_lib.Invoice | None:
        # Create an invoice, then add line items to it
        invoice = await stripe_lib.Invoice.create_async(
            customer=customer.id,
            description=f"""You pledged to {pledge.issue_reference} on {pledge.created_at.strftime("%Y-%m-%d")}, which has now been fixed!

Thank you for your support!
""",  # noqa: E501
            metadata={
                "type": ProductType.pledge,
                "pledge_id": str(pledge.id),
            },
            days_until_due=7,
            collection_method="send_invoice",
            # Enabling auto_advance means that Stripe will automatically send emails
            # and reminders to the Customer to notify them about this invoice.
            auto_advance=True,
        )

        assert invoice.id is not None

        await stripe_lib.InvoiceItem.create_async(
            invoice=invoice.id,
            customer=customer.id,
            amount=pledge.amount_including_fee,
            description=f"Pledge to {pledge.issue_reference}",  # noqa: E501
            currency="USD",
            metadata={
                "type": ProductType.pledge,
                "pledge_id": str(pledge.id),
            },
        )

        await stripe_lib.Invoice.finalize_invoice_async(invoice.id, auto_advance=True)

        sent_invoice = await stripe_lib.Invoice.send_invoice_async(invoice.id)

        return sent_invoice


pledge_stripe_service = PledgeStripeService()
