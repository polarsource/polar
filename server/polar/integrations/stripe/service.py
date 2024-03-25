import uuid
from collections.abc import Iterator
from typing import Literal, TypedDict, Unpack, cast

import stripe as stripe_lib
from stripe import error as stripe_lib_error

from polar.account.schemas import AccountCreate
from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.exceptions import InternalServerError, PolarError
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PledgePaymentIntentMetadata,
)
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession, sql

stripe_lib.api_key = settings.STRIPE_SECRET_KEY

StripeError = stripe_lib_error.StripeError


class ProductUpdateKwargs(TypedDict, total=False):
    name: str
    description: str
    default_price: str


class MissingOrganizationBillingEmail(PolarError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization {organization_id} billing email is not set."
        super().__init__(message)


class StripeService:
    async def _get_customer(
        self,
        session: AsyncSession,
        customer: User | Organization | None = None,
    ) -> stripe_lib.Customer | None:
        if isinstance(customer, User):
            return await self.get_or_create_user_customer(session, customer)
        if isinstance(customer, Organization):
            return await self.get_or_create_org_customer(session, customer)
        return None

    async def create_payment_intent(
        self,
        session: AsyncSession,
        *,
        amount: CurrencyAmount,
        transfer_group: str | None = None,
        metadata: PledgePaymentIntentMetadata
        | DonationPaymentIntentMetadata
        | None = None,
        receipt_email: str,
        description: str,
        customer: User | Organization | None = None,
    ) -> stripe_lib.PaymentIntent:
        params: stripe_lib.PaymentIntent.CreateParams = {
            "amount": amount.amount,
            "currency": amount.currency,
            "receipt_email": receipt_email,
            "description": description,
        }

        if transfer_group:
            params["transfer_group"] = transfer_group

        if metadata is not None:
            params["metadata"] = metadata.model_dump(exclude_none=True)

        if customer is not None:
            stripe_customer = await self._get_customer(session, customer)
            if not stripe_customer:
                raise InternalServerError("Failed to create Stripe Customer")
            params["customer"] = stripe_customer.id

        return stripe_lib.PaymentIntent.create(**params)

    async def modify_payment_intent(
        self,
        session: AsyncSession,
        id: str,
        *,
        amount: CurrencyAmount,
        transfer_group: str | None = None,
        metadata: PledgePaymentIntentMetadata
        | DonationPaymentIntentMetadata
        | None = None,
        receipt_email: str | None = None,
        description: str | None = None,
        customer: User | Organization | None = None,
        setup_future_usage: Literal["off_session", "on_session"] | None = None,
    ) -> stripe_lib.PaymentIntent:
        params: stripe_lib.PaymentIntent.ModifyParams = {
            "amount": amount.amount,
            "currency": amount.currency,
        }

        if receipt_email is not None:
            params["receipt_email"] = receipt_email

        if description is not None:
            params["description"] = description

        if transfer_group:
            params["transfer_group"] = transfer_group

        if setup_future_usage is not None:
            params["setup_future_usage"] = setup_future_usage

        if metadata is not None:
            params["metadata"] = metadata.model_dump(exclude_none=True)

        if customer is not None:
            stripe_customer = await self._get_customer(session, customer)
            if not stripe_customer:
                raise InternalServerError("Failed to create Stripe Customer")
            params["customer"] = stripe_customer.id

        return stripe_lib.PaymentIntent.modify(
            id,
            **params,
        )

    def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.retrieve(id)

    def create_account(
        self, account: AccountCreate, name: str | None
    ) -> stripe_lib.Account:
        create_params: stripe_lib.Account.CreateParams = {
            "country": account.country,
            "type": "express",
            "capabilities": {"transfers": {"requested": True}},
            "settings": {
                "payouts": {"schedule": {"interval": "manual"}},
            },
        }

        if name:
            create_params["business_profile"] = {"name": name}

        if account.country != "US":
            create_params["tos_acceptance"] = {"service_agreement": "recipient"}
        return stripe_lib.Account.create(**create_params)

    def update_account(self, id: str, name: str | None) -> None:
        obj = {}
        if name:
            obj["business_profile"] = {"name": name}
        stripe_lib.Account.modify(id, **obj)

    def retrieve_account(self, id: str) -> stripe_lib.Account:
        return stripe_lib.Account.retrieve(id)

    def retrieve_balance(self, id: str) -> tuple[str, int]:
        # Return available balance in the account's default currency (we assume that
        # there is no balance in other currencies for now)
        account = stripe_lib.Account.retrieve(id)
        balance = stripe_lib.Balance.retrieve(stripe_account=id)
        for b in balance.available:
            if b.currency == account.default_currency:
                return (b.currency, b.amount)
        return (cast(str, account.default_currency), 0)

    def create_account_link(
        self, stripe_id: str, return_path: str
    ) -> stripe_lib.AccountLink:
        refresh_url = settings.generate_external_url(
            f"/integrations/stripe/refresh?return_path={return_path}"
        )
        return_url = settings.generate_frontend_url(return_path)
        return stripe_lib.AccountLink.create(
            account=stripe_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )

    def create_login_link(self, stripe_id: str) -> stripe_lib.LoginLink:
        return stripe_lib.Account.create_login_link(stripe_id)

    def transfer(
        self,
        destination_stripe_id: str,
        amount: int,
        *,
        source_transaction: str | None = None,
        transfer_group: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Transfer:
        create_params: stripe_lib.Transfer.CreateParams = {
            "amount": amount,
            "currency": "usd",
            "destination": destination_stripe_id,
            "metadata": metadata or {},
        }
        if source_transaction is not None:
            create_params["source_transaction"] = source_transaction
        if transfer_group is not None:
            create_params["transfer_group"] = transfer_group
        return stripe_lib.Transfer.create(**create_params)

    def reverse_transfer(
        self,
        transfer_id: str,
        amount: int,
        *,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Reversal:
        create_params: stripe_lib.Transfer.CreateReversalParams = {
            "amount": amount,
            "metadata": metadata or {},
        }
        return stripe_lib.Transfer.create_reversal(transfer_id, **create_params)

    def get_transfer(self, id: str) -> stripe_lib.Transfer:
        return stripe_lib.Transfer.retrieve(id)

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
            name=user.username_or_email,
            email=user.email,
            metadata={
                "user_id": str(user.id),
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

        if org.billing_email is None:
            raise MissingOrganizationBillingEmail(org.id)

        customer = stripe_lib.Customer.create(
            name=org.name,
            email=org.billing_email,
            metadata={
                "org_id": str(org.id),
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
        return stripe_lib.PaymentMethod.detach(id)

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

    def create_product(
        self,
        name: str,
        *,
        description: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Product:
        create_params: stripe_lib.Product.CreateParams = {
            "name": name,
            "metadata": metadata or {},
        }
        if description is not None:
            create_params["description"] = description
        return stripe_lib.Product.create(**create_params)

    def create_price_for_product(
        self,
        product: str,
        price_amount: int,
        price_currency: str,
        interval: Literal["day", "month", "week", "year"],
        *,
        set_default: bool = False,
    ) -> stripe_lib.Price:
        price = stripe_lib.Price.create(
            currency=price_currency,
            product=product,
            unit_amount=price_amount,
            recurring={"interval": interval},
        )
        if set_default:
            stripe_lib.Product.modify(product, default_price=price.id)
        return price

    def update_product(
        self, product: str, **kwargs: Unpack[ProductUpdateKwargs]
    ) -> stripe_lib.Product:
        return stripe_lib.Product.modify(product, **kwargs)

    def archive_product(self, id: str) -> stripe_lib.Product:
        return stripe_lib.Product.modify(id, active=False)

    def get_price(self, id: str) -> stripe_lib.Price:
        return stripe_lib.Price.retrieve(id)

    def archive_price(self, id: str) -> stripe_lib.Price:
        return stripe_lib.Price.modify(id, active=False)

    def create_subscription_checkout_session(
        self,
        price: str,
        success_url: str,
        *,
        is_tax_applicable: bool,
        customer: str | None = None,
        customer_email: str | None = None,
        metadata: dict[str, str] | None = None,
        subscription_metadata: dict[str, str] | None = None,
    ) -> stripe_lib.checkout.Session:
        create_params: stripe_lib.checkout.Session.CreateParams = {
            "success_url": success_url,
            "line_items": [
                {
                    "price": price,
                    "quantity": 1,
                },
            ],
            "mode": "subscription",
            "automatic_tax": {"enabled": is_tax_applicable},
            "tax_id_collection": {"enabled": is_tax_applicable},
            "payment_method_collection": "if_required",
            "metadata": metadata or {},
        }
        if customer is not None:
            create_params["customer"] = customer
            create_params["customer_update"] = {"name": "auto", "address": "auto"}
        if customer_email is not None:
            create_params["customer_email"] = customer_email
        if subscription_metadata is not None:
            create_params["subscription_data"] = {"metadata": subscription_metadata}
        return stripe_lib.checkout.Session.create(**create_params)

    def get_checkout_session(self, id: str) -> stripe_lib.checkout.Session:
        return stripe_lib.checkout.Session.retrieve(id)

    def get_subscription(self, id: str) -> stripe_lib.Subscription:
        return stripe_lib.Subscription.retrieve(id, expand=["latest_invoice"])

    def update_subscription_price(
        self, id: str, *, old_price: str, new_price: str
    ) -> stripe_lib.Subscription:
        subscription = stripe_lib.Subscription.retrieve(id)

        old_items = subscription["items"]
        new_items: list[stripe_lib.Subscription.ModifyParamsItem] = []
        for item in old_items:
            if item.price.id == old_price:
                new_items.append({"id": item.id, "deleted": True})
        new_items.append({"price": new_price, "quantity": 1})

        return stripe_lib.Subscription.modify(id, items=new_items)

    def cancel_subscription(self, id: str) -> stripe_lib.Subscription:
        return stripe_lib.Subscription.modify(
            id,
            cancel_at_period_end=True,
        )

    def update_invoice(
        self, id: str, *, metadata: dict[str, str] | None = None
    ) -> stripe_lib.Invoice:
        return stripe_lib.Invoice.modify(id, metadata=metadata or {})

    def get_customer_credit_balance(self, customer_id: str) -> int:
        transactions = stripe_lib.Customer.list_balance_transactions(
            customer_id, limit=1
        )

        for transaction in transactions:
            return transaction.ending_balance

        return 0

    async def get_organization_credit_balance(
        self,
        session: AsyncSession,
        org: Organization,
    ) -> int | None:
        customer = await self.get_or_create_org_customer(session, org)
        if not customer:
            return 0

        transactions = stripe_lib.Customer.list_balance_transactions(
            customer.id, limit=1
        )

        for transaction in transactions:
            return transaction.ending_balance

        return 0

    def get_balance_transaction(self, id: str) -> stripe_lib.BalanceTransaction:
        return stripe_lib.BalanceTransaction.retrieve(id)

    def get_invoice(self, id: str) -> stripe_lib.Invoice:
        return stripe_lib.Invoice.retrieve(id, expand=["total_tax_amounts.tax_rate"])

    def list_balance_transactions(
        self,
        *,
        account_id: str | None = None,
        payout: str | None = None,
        type: str | None = None,
    ) -> Iterator[stripe_lib.BalanceTransaction]:
        params: stripe_lib.BalanceTransaction.ListParams = {
            "limit": 100,
            "stripe_account": account_id,
            "expand": ["data.source"],
        }
        if payout is not None:
            params["payout"] = payout
        if type is not None:
            params["type"] = type

        return stripe_lib.BalanceTransaction.list(**params).auto_paging_iter()

    def list_refunds(
        self,
        *,
        charge: str | None = None,
    ) -> Iterator[stripe_lib.Refund]:
        params: stripe_lib.Refund.ListParams = {"limit": 100}
        if charge is not None:
            params["charge"] = charge  # type: ignore

        return stripe_lib.Refund.list(**params).auto_paging_iter()

    def get_charge(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Charge:
        return stripe_lib.Charge.retrieve(
            id, stripe_account=stripe_account, expand=expand or []
        )

    def get_refund(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Refund:
        return stripe_lib.Refund.retrieve(
            id, stripe_account=stripe_account, expand=expand or []
        )

    def get_dispute(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Dispute:
        return stripe_lib.Dispute.retrieve(
            id, stripe_account=stripe_account, expand=expand or []
        )

    def create_payout(
        self,
        *,
        stripe_account: str,
        amount: int,
        currency: str,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Payout:
        return stripe_lib.Payout.create(
            stripe_account=stripe_account,
            amount=amount,
            currency=currency,
            metadata=metadata or {},
        )


stripe = StripeService()
