from typing import Any, Literal, Tuple, TypedDict, Unpack
from uuid import UUID

import stripe as stripe_lib
from stripe import error as stripe_lib_error

from polar.account.schemas import AccountCreate
from polar.config import settings
from polar.integrations.stripe.schemas import PaymentIntentMetadata
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession, sql

stripe_lib.api_key = settings.STRIPE_SECRET_KEY

StripeError = stripe_lib_error.StripeError


class ProductUpdateKwargs(TypedDict, total=False):
    name: str
    description: str


class StripeService:
    def create_anonymous_intent(
        self,
        amount: int,
        transfer_group: str,
        issue: Issue,
        anonymous_email: str,
    ) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            metadata={
                "issue_id": issue.id,
                "issue_title": issue.title,
                "anonymous": "true",
                "anonymous_email": anonymous_email,
            },
            receipt_email=anonymous_email,
        )

    async def create_user_intent(
        self,
        session: AsyncSession,
        amount: int,
        transfer_group: str,
        issue: Issue,
        user: User,
        on_behalf_of_organization_id: UUID | None = None,
    ) -> stripe_lib.PaymentIntent:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            raise Exception("failed to get/create customer")

        metadata = PaymentIntentMetadata(
            issue_id=issue.id,
            issue_title=issue.title,
            user_id=user.id,
            user_username=user.username,
            user_email=user.email,
        )

        if on_behalf_of_organization_id:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization_id

        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            customer=customer.id,
            metadata=metadata.dict(exclude_none=True),
            receipt_email=user.email,
        )

    def create_organization_intent(
        self,
        amount: int,
        transfer_group: str,
        issue: Issue,
        organization: Organization,
        user: User,
    ) -> stripe_lib.PaymentIntent:
        metadata = PaymentIntentMetadata(
            issue_id=issue.id,
            issue_title=issue.title,
            user_id=user.id,
            user_username=user.username,
            user_email=user.email,
            organization_id=organization.id,
            organization_name=organization.name,
        )

        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            metadata=metadata.dict(exclude_none=True),
            receipt_email=user.email,
        )

    def modify_intent(
        self,
        id: str,
        amount: int,
        receipt_email: str,
        setup_future_usage: Literal["off_session", "on_session"] | None,
        on_behalf_of_organization_id: UUID | None = None,
    ) -> stripe_lib.PaymentIntent:
        metadata = PaymentIntentMetadata(
            on_behalf_of_organization_id=on_behalf_of_organization_id
            if on_behalf_of_organization_id
            else "",  # Set to empty string to unset the value on Stripe.
        )

        print(metadata.dict(exclude_none=True))

        return stripe_lib.PaymentIntent.modify(
            id,
            amount=amount,
            receipt_email=receipt_email,
            setup_future_usage=setup_future_usage,
            metadata=metadata.dict(exclude_none=True),
        )

    def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.retrieve(id)

    def create_account(self, account: AccountCreate) -> stripe_lib.Account:
        tos_acceptance = (
            {"service_agreement": "recipient"} if account.country != "US" else None
        )
        return stripe_lib.Account.create(
            country=account.country,
            type="express",
            tos_acceptance=tos_acceptance,
            capabilities={"transfers": {"requested": True}},
        )

    def retrieve_account(self, id: str) -> stripe_lib.Account:
        return stripe_lib.Account.retrieve(id)

    def retrieve_balance(self, id: str) -> Tuple[str, int]:
        # Return available balance in the account's default currency (we assume that
        # there is no balance in other currencies for now)
        account = stripe_lib.Account.retrieve(id)
        balance = stripe_lib.Balance.retrieve(stripe_account=id)
        for b in balance["available"]:
            if b["currency"] == account.default_currency:
                return (b["currency"], b["amount"])
        return (account.default_currency, 0)

    def create_account_link(self, stripe_id: str) -> stripe_lib.AccountLink:
        refresh_url = settings.generate_external_url(
            f"/integrations/stripe/refresh?stripe_id={stripe_id}"
        )
        return_url = settings.generate_external_url(
            f"/integrations/stripe/return?stripe_id={stripe_id}"
        )
        return stripe_lib.AccountLink.create(
            account=stripe_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )

    def create_login_link(self, stripe_id: str) -> stripe_lib.AccountLink:
        return stripe_lib.Account.create_login_link(stripe_id)

    def transfer(
        self, destination_stripe_id: str, amount: int, transfer_group: str
    ) -> stripe_lib.Transfer:
        return stripe_lib.Transfer.create(
            amount=amount,
            currency="usd",
            destination=destination_stripe_id,
            transfer_group=transfer_group,
        )

    def get_customer(self, customer_id: str) -> stripe_lib.Customer:
        return stripe_lib.Customer.retrieve(customer_id)

    async def get_or_create_user_customer(
        self,
        session: AsyncSession,
        user: User,
    ) -> stripe_lib.Customer | None:
        if user.stripe_customer_id:
            return self.get_customer(user.stripe_customer_id)

        customer = stripe_lib.Customer.create(
            name=user.username,
            email=user.email,
            metadata={
                "user_id": user.id,
                "email": user.email,
            },
        )

        if not customer:
            return None

        # Save customer ID
        stmt = (
            sql.Update(User)
            .where(User.id == user.id)
            .values(stripe_customer_id=customer.id)
        )
        await session.execute(stmt)
        await session.commit()

        return customer

    async def get_or_create_org_customer(
        self, session: AsyncSession, org: Organization
    ) -> stripe_lib.Customer | None:
        if org.stripe_customer_id:
            return self.get_customer(org.stripe_customer_id)

        customer = stripe_lib.Customer.create(
            name=org.name,
            email=org.billing_email,
            metadata={
                "org_id": org.id,
            },
        )

        if not customer:
            return None

        # Save customer ID
        stmt = (
            sql.Update(Organization)
            .where(Organization.id == org.id)
            .values(stripe_customer_id=customer.id)
        )
        await session.execute(stmt)
        await session.commit()

        return customer

    async def list_user_payment_methods(
        self,
        session: AsyncSession,
        user: User,
    ) -> list[stripe_lib.PaymentMethod]:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            return []

        payment_methods = stripe_lib.PaymentMethod.list(
            customer=customer.id,
            type="card",
        )

        return payment_methods.data

    def detach_payment_method(self, id: str) -> stripe_lib.PaymentMethod:
        return stripe_lib.PaymentMethod.detach(id)  # type: ignore

    async def create_pledge_invoice(
        self,
        session: AsyncSession,
        user: User,
        pledge: Pledge,
        pledge_issue: Issue,
        pledge_issue_repo: Repository,
        pledge_issue_org: Organization,
    ) -> stripe_lib.Invoice | None:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            return None

        # Sync email
        if not customer.email or customer.email != user.email:
            stripe_lib.Customer.modify(
                customer.id,
                email=user.email,
            )

        # Create an invoice, then add line items to it
        invoice = stripe_lib.Invoice.create(
            customer=customer.id,
            description=f"""You pledged to {pledge_issue_org.name}/{pledge_issue_repo.name}#{pledge_issue.number} on {pledge.created_at.strftime('%Y-%m-%d')}, which has now been fixed!
            
Thank you for your support!
""",  # noqa: E501
            metadata={
                "pledge_id": pledge.id,
            },
            days_until_due=7,
            collection_method="send_invoice",
            # Enabling auto_advance means that Stripe will automatically send emails
            # and reminders to the Customer to notify them about this invoice.
            auto_advance=True,
        )

        stripe_lib.InvoiceItem.create(
            invoice=invoice.id,
            customer=customer.id,
            amount=pledge.amount_including_fee,
            description=f"Pledge to {pledge_issue_org.name}/{pledge_issue_repo.name}#{pledge_issue.number}",  # noqa: E501
            currency="USD",
            metadata={
                "pledge_id": pledge.id,
            },
        )

        stripe_lib.Invoice.finalize_invoice(invoice.id, auto_advance=True)

        sent_invoice = stripe_lib.Invoice.send_invoice(invoice.id)

        return sent_invoice

    async def create_user_portal_session(
        self,
        session: AsyncSession,
        user: User,
    ) -> stripe_lib.billing_portal.Session | None:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            return None

        return stripe_lib.billing_portal.Session.create(
            customer=customer.id,
            return_url=f"{settings.FRONTEND_BASE_URL}/settings",
        )

    async def create_org_portal_session(
        self,
        session: AsyncSession,
        org: Organization,
    ) -> stripe_lib.billing_portal.Session | None:
        customer = await self.get_or_create_org_customer(session, org)
        if not customer:
            return None

        return stripe_lib.billing_portal.Session.create(
            customer=customer.id,
            return_url=f"{settings.FRONTEND_BASE_URL}/team/{org.name}/settings",
        )

    def create_product_with_price(
        self,
        name: str,
        *,
        price_amount: int,
        price_currency: str,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> stripe_lib.Product:
        default_price_data = {
            "currency": price_currency,
            "unit_amount": price_amount,
            "recurring": {"interval": "month"},
        }
        product = stripe_lib.Product.create(
            name=name,
            description=description,
            default_price_data=default_price_data,
            metadata=metadata or {},
        )
        return product

    def create_price_for_product(
        self,
        product: str,
        price_amount: int,
        price_currency: str,
        *,
        set_default: bool = False,
    ) -> stripe_lib.Price:
        price = stripe_lib.Price.create(
            currency=price_currency,
            product=product,
            unit_amount=price_amount,
            recurring={"interval": "month"},
        )
        if set_default:
            stripe_lib.Product.modify(product, default_price=price.stripe_id)
        return price

    def update_product(
        self, product: str, **kwargs: Unpack[ProductUpdateKwargs]
    ) -> stripe_lib.Product:
        return stripe_lib.Product.modify(product, **kwargs)

    def archive_product(self, id: str) -> stripe_lib.Product:
        return stripe_lib.Product.modify(id, active=False)

    def archive_price(self, id: str) -> stripe_lib.Price:
        return stripe_lib.Price.modify(id, active=False)

    def create_subscription_checkout_session(
        self,
        price: str,
        success_url: str,
        *,
        customer: str | None = None,
        customer_email: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.checkout.Session:
        return stripe_lib.checkout.Session.create(
            success_url=success_url,
            line_items=[
                {
                    "price": price,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            automatic_tax={"enabled": True},
            customer=customer,
            customer_email=customer_email,
            payment_method_collection="if_required",
            metadata=metadata,
        )

    def get_checkout_session(self, id: str) -> stripe_lib.checkout.Session:
        return stripe_lib.checkout.Session.retrieve(id)

    # def get_customer_credit_balance(self, customer_id: str) -> int:
    #     transactions = stripe_lib.Customer.list_balance_transactions(
    #         customer_id, limit=1
    #     )

    #     if not transactions:
    #         return 0

    #     transactions["data"][0]

    #     data: list[stripe_lib.CustomerBalanceTransaction] = transactions

    #     if len(data) == 0:
    #         return 0

    #     return data[0].ending_balance


stripe = StripeService()
