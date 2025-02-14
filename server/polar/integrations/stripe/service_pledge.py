from typing import Literal
from uuid import UUID

import stripe as stripe_lib

from polar.config import settings
from polar.integrations.stripe.schemas import (
    PledgePaymentIntentMetadata,
    ProductType,
)
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession

from .service import MissingOrganizationBillingEmail
from .service import stripe as stripe_service

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class PledgeStripeService:
    async def create_anonymous_intent(
        self,
        amount: int,
        currency: str,
        pledge_issue: Issue,
        pledge_issue_org: ExternalOrganization,
        pledge_issue_repo: Repository,
        anonymous_email: str,
    ) -> stripe_lib.PaymentIntent:
        metadata = PledgePaymentIntentMetadata(
            issue_id=pledge_issue.id,
            issue_title=pledge_issue.title,
            anonymous=True,
            anonymous_email=anonymous_email,
        )
        return await stripe_lib.PaymentIntent.create_async(
            amount=amount,
            currency=currency,
            metadata=metadata.model_dump(exclude_none=True),
            receipt_email=anonymous_email,
            description=f"Pledge to {pledge_issue_org.name}/{pledge_issue_repo.name}#{pledge_issue.number}",  # noqa: E501
        )

    async def create_user_intent(
        self,
        session: AsyncSession,
        amount: int,
        currency: str,
        pledge_issue: Issue,
        pledge_issue_org: ExternalOrganization,
        pledge_issue_repo: Repository,
        user: User,
        on_behalf_of_organization_id: UUID | None = None,
    ) -> stripe_lib.PaymentIntent:
        customer = await stripe_service.get_or_create_user_customer(session, user)
        if not customer:
            raise Exception("failed to get/create customer")

        metadata = PledgePaymentIntentMetadata(
            issue_id=pledge_issue.id,
            issue_title=pledge_issue.title,
            user_id=user.id,
            user_email=user.email,
        )

        if on_behalf_of_organization_id:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization_id

        return await stripe_lib.PaymentIntent.create_async(
            amount=amount,
            currency=currency,
            customer=customer.id,
            metadata=metadata.model_dump(exclude_none=True),
            receipt_email=user.email,
            description=f"Pledge to {pledge_issue_org.name}/{pledge_issue_repo.name}#{pledge_issue.number}",  # noqa: E501
        )

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
        self,
        session: AsyncSession,
        user: User,
        pledge: Pledge,
        pledge_issue: Issue,
        pledge_issue_repo: Repository,
        pledge_issue_external_org: ExternalOrganization,
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

        return await self.create_pledge_invoice(
            customer,
            pledge,
            pledge_issue,
            pledge_issue_repo,
            pledge_issue_external_org,
        )

    async def create_organization_pledge_invoice(
        self,
        session: AsyncSession,
        organization: Organization,
        pledge: Pledge,
        pledge_issue: Issue,
        pledge_issue_repo: Repository,
        pledge_issue_external_org: ExternalOrganization,
    ) -> stripe_lib.Invoice | None:
        customer = await stripe_service.get_or_create_org_customer(
            session, organization
        )
        if not customer:
            return None

        if organization.billing_email is None:
            raise MissingOrganizationBillingEmail(organization.id)

        # Sync billing email
        if not customer.email or customer.email != organization.billing_email:
            await stripe_lib.Customer.modify_async(
                customer.id,
                email=organization.billing_email,
            )

        return await self.create_pledge_invoice(
            customer,
            pledge,
            pledge_issue,
            pledge_issue_repo,
            pledge_issue_external_org,
        )

    async def create_pledge_invoice(
        self,
        customer: stripe_lib.Customer,
        pledge: Pledge,
        pledge_issue: Issue,
        pledge_issue_repo: Repository,
        pledge_issue_external_org: ExternalOrganization,
    ) -> stripe_lib.Invoice | None:
        # Create an invoice, then add line items to it
        invoice = await stripe_lib.Invoice.create_async(
            customer=customer.id,
            description=f"""You pledged to {pledge_issue_external_org.name}/{pledge_issue_repo.name}#{pledge_issue.number} on {pledge.created_at.strftime("%Y-%m-%d")}, which has now been fixed!

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
            description=f"Pledge to {pledge_issue_external_org.name}/{pledge_issue_repo.name}#{pledge_issue.number}",  # noqa: E501
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
