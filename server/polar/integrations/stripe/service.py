import stripe as stripe_lib

from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.postgres import AsyncSession, sql

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    def create_intent(
        self,
        amount: int,
        transfer_group: str,
        issue: Issue,
    ) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            metadata={
                "issue_id": issue.id,
                "issue_title": issue.title,
            },
        )

    async def create_confirmed_payment_intent_for_organization(
        self,
        session: AsyncSession,
        amount: int,
        transfer_group: str,
        issue: Issue,
        organization: Organization,
    ) -> stripe_lib.PaymentIntent:
        """
        create_confirmed_payment_intent_for_organization attempts to create a
        PaymentIntent without user interaction (1-click pledging).

        It uses an existing Customer and it's PaymentMethod (created from a SetupIntent)
        """
        customer = await self.get_or_create_customer(session, organization)

        if not customer:
            raise Exception("could not find a stripe customer")

        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            # setup_future_usage="off_session",
            metadata={
                "issue_id": issue.id,
                "issue_title": issue.title,
            },
            customer=customer.id,
            # payment_method="pm",
        )

    def modify_intent(self, id: str, amount: int) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.modify(
            id,
            amount=amount,
        )

    def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.retrieve(id)

    def create_account(self) -> stripe_lib.Account:
        return stripe_lib.Account.create(type="express")

    def retrieve_account(self, id: str) -> stripe_lib.Account:
        return stripe_lib.Account.retrieve(id)

    def retrieve_balance(self, id: str) -> int:
        # Return available USD on the specified account
        balance = stripe_lib.Balance.retrieve(stripe_account=id)
        for b in balance["available"]:
            if b["currency"] == "usd":
                return b["amount"]
        return 0

    def create_account_link(
        self, stripe_id: str, appendix: str | None = None
    ) -> stripe_lib.AccountLink:
        refresh_url = settings.generate_external_url("/integrations/stripe/refresh") + (
            appendix or ""
        )
        return_url = settings.generate_external_url("/integrations/stripe/return") + (
            appendix or ""
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

    def get_payment_method(self, id: str) -> stripe_lib.PaymentMethod:
        return stripe_lib.PaymentMethod.retrieve(id)

    async def get_or_create_customer(
        self, session: AsyncSession, org: Organization
    ) -> stripe_lib.Customer | None:
        if org.stripe_customer_id:
            return stripe_lib.Customer.retrieve(org.stripe_customer_id)

        customer = stripe_lib.Customer.create(
            name=org.platform + "/" + org.name,
            metadata={
                "organization_id": org.id,
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

    async def create_setup_intent(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> stripe_lib.SetupIntent:
        """
        create_setup_intent creates a SetupIntent
        A SetupIntent (once confirmed), will allow us to attach it as a PaymentMethod
        for future usage to the Customer.
        """
        customer = await self.get_or_create_customer(session, organization)

        if not customer:
            raise Exception("could not find a stripe customer")

        return stripe_lib.SetupIntent.create(
            payment_method_types=["card"],
            customer=customer.id,
            description="Default payment method for " + organization.name,
            usage="off_session",
        )

    async def set_default_payment_method(
        self, session: AsyncSession, organization: Organization, payment_method_id: str
    ):
        cust = await self.get_or_create_customer(session, organization)
        if not cust:
            raise Exception("could ont get stripe customer")

        stripe_lib.Customer(
            cust.id,
            invoice_settings={
                "default_payment_method": payment_method_id,
            },
        )


stripe = StripeService()
