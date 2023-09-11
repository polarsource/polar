from typing import Literal, Tuple

import stripe as stripe_lib

from polar.account.schemas import AccountCreate
from polar.config import settings
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession, sql

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


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
    ) -> stripe_lib.PaymentIntent:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            raise Exception("failed to get/create customer")

        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            customer=customer.id,
            metadata={
                "issue_id": issue.id,
                "issue_title": issue.title,
                "user_id": user.id,
                "user_username": user.username,
                "user_email": user.email,
            },
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
        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=transfer_group,
            metadata={
                "issue_id": issue.id,
                "issue_title": issue.title,
                "user_id": user.id,
                "user_username": user.username,
                "user_email": user.email,
                "organization_id": organization.id,
                "organization_name": organization.name,
            },
            receipt_email=user.email,
        )

    def modify_intent(
        self,
        id: str,
        amount: int,
        receipt_email: str,
        setup_future_usage: Literal["off_session", "on_session"] | None,
    ) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.modify(
            id,
            amount=amount,
            receipt_email=receipt_email,
            setup_future_usage=setup_future_usage,
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

    async def get_or_create_user_customer(
        self,
        session: AsyncSession,
        user: User,
    ) -> stripe_lib.Customer | None:
        if user.stripe_customer_id:
            return stripe_lib.Customer.retrieve(user.stripe_customer_id)

        customer = stripe_lib.Customer.create(
            name=user.username,
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


stripe = StripeService()
