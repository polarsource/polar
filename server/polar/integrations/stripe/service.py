import uuid
from collections.abc import AsyncIterator
from typing import Literal, Unpack, cast

import stripe as stripe_lib

from polar.account.schemas import AccountCreate
from polar.config import settings
from polar.exceptions import InternalServerError, PolarError
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PledgePaymentIntentMetadata,
)
from polar.integrations.stripe.utils import get_expandable_id
from polar.logfire import instrument_httpx
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession, sql

stripe_lib.api_key = settings.STRIPE_SECRET_KEY

stripe_http_client = stripe_lib.HTTPXClient()
instrument_httpx(stripe_http_client._client_async)
stripe_lib.default_http_client = stripe_http_client


class MissingOrganizationBillingEmail(PolarError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization {organization_id} billing email is not set."
        super().__init__(message)


class MissingLatestInvoiceForOutofBandSubscription(PolarError):
    def __init__(self, subscription_id: str) -> None:
        self.subscription_id = subscription_id
        message = f"The subscription {subscription_id} does not have a latest invoice."
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

    async def create_pledge_payment_intent(
        self,
        session: AsyncSession,
        *,
        amount: int,
        currency: str,
        metadata: PledgePaymentIntentMetadata
        | DonationPaymentIntentMetadata
        | None = None,
        receipt_email: str,
        description: str,
        customer: User | Organization | None = None,
    ) -> stripe_lib.PaymentIntent:
        params: stripe_lib.PaymentIntent.CreateParams = {
            "amount": amount,
            "currency": currency,
            "receipt_email": receipt_email,
            "description": description,
        }

        if metadata is not None:
            params["metadata"] = metadata.model_dump(exclude_none=True)

        if customer is not None:
            stripe_customer = await self._get_customer(session, customer)
            if not stripe_customer:
                raise InternalServerError("Failed to create Stripe Customer")
            params["customer"] = stripe_customer.id

        return await stripe_lib.PaymentIntent.create_async(**params)

    async def modify_payment_intent(
        self,
        session: AsyncSession,
        id: str,
        *,
        amount: int,
        currency: str,
        metadata: PledgePaymentIntentMetadata
        | DonationPaymentIntentMetadata
        | None = None,
        receipt_email: str | None = None,
        description: str | None = None,
        customer: User | Organization | None = None,
        setup_future_usage: Literal["off_session", "on_session"] | None = None,
    ) -> stripe_lib.PaymentIntent:
        params: stripe_lib.PaymentIntent.ModifyParams = {
            "amount": amount,
            "currency": currency,
        }

        if receipt_email is not None:
            params["receipt_email"] = receipt_email

        if description is not None:
            params["description"] = description

        if setup_future_usage is not None:
            params["setup_future_usage"] = setup_future_usage

        if metadata is not None:
            params["metadata"] = metadata.model_dump(exclude_none=True)

        if customer is not None:
            stripe_customer = await self._get_customer(session, customer)
            if not stripe_customer:
                raise InternalServerError("Failed to create Stripe Customer")
            params["customer"] = stripe_customer.id

        return await stripe_lib.PaymentIntent.modify_async(
            id,
            **params,
        )

    async def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.retrieve_async(id)

    async def create_account(
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
        return await stripe_lib.Account.create_async(**create_params)

    async def update_account(self, id: str, name: str | None) -> None:
        obj = {}
        if name:
            obj["business_profile"] = {"name": name}
        await stripe_lib.Account.modify_async(id, **obj)

    async def retrieve_balance(self, id: str) -> tuple[str, int]:
        # Return available balance in the account's default currency (we assume that
        # there is no balance in other currencies for now)
        account = await stripe_lib.Account.retrieve_async(id)
        balance = await stripe_lib.Balance.retrieve_async(stripe_account=id)
        for b in balance.available:
            if b.currency == account.default_currency:
                return (b.currency, b.amount)
        return (cast(str, account.default_currency), 0)

    async def create_account_link(
        self, stripe_id: str, return_path: str
    ) -> stripe_lib.AccountLink:
        refresh_url = settings.generate_external_url(
            f"/integrations/stripe/refresh?return_path={return_path}"
        )
        return_url = settings.generate_frontend_url(return_path)
        return await stripe_lib.AccountLink.create_async(
            account=stripe_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )

    async def create_login_link(self, stripe_id: str) -> stripe_lib.LoginLink:
        return await stripe_lib.Account.create_login_link_async(stripe_id)

    async def transfer(
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
        return await stripe_lib.Transfer.create_async(**create_params)

    async def get_transfer(self, id: str) -> stripe_lib.Transfer:
        return await stripe_lib.Transfer.retrieve_async(id)

    async def update_transfer(
        self, id: str, metadata: dict[str, str]
    ) -> stripe_lib.Transfer:
        update_params: stripe_lib.Transfer.ModifyParams = {
            "metadata": metadata,
        }
        return await stripe_lib.Transfer.modify_async(id, **update_params)

    async def get_customer(self, customer_id: str) -> stripe_lib.Customer:
        return await stripe_lib.Customer.retrieve_async(customer_id)

    async def get_or_create_user_customer(
        self,
        session: AsyncSession,
        user: User,
    ) -> stripe_lib.Customer | None:
        if user.stripe_customer_id:
            return await self.get_customer(user.stripe_customer_id)

        customer = await stripe_lib.Customer.create_async(
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
            return await self.get_customer(org.stripe_customer_id)

        if org.billing_email is None:
            raise MissingOrganizationBillingEmail(org.id)

        customer = await stripe_lib.Customer.create_async(
            name=org.slug,
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

        payment_methods = await stripe_lib.PaymentMethod.list_async(
            customer=customer.id,
            type="card",
        )

        return payment_methods.data

    async def detach_payment_method(self, id: str) -> stripe_lib.PaymentMethod:
        return await stripe_lib.PaymentMethod.detach_async(id)

    async def create_user_portal_session(
        self,
        session: AsyncSession,
        user: User,
    ) -> stripe_lib.billing_portal.Session | None:
        customer = await self.get_or_create_user_customer(session, user)
        if not customer:
            return None

        return await stripe_lib.billing_portal.Session.create_async(
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

        return await stripe_lib.billing_portal.Session.create_async(
            customer=customer.id,
            return_url=f"{settings.FRONTEND_BASE_URL}/team/{org.slug}/settings",
        )

    async def create_product(
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
        return await stripe_lib.Product.create_async(**create_params)

    async def create_price_for_product(
        self,
        product: str,
        params: stripe_lib.Price.CreateParams,
        *,
        set_default: bool = False,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Price:
        params = {**params, "product": product}
        if idempotency_key is not None:
            params["idempotency_key"] = idempotency_key
        price = await stripe_lib.Price.create_async(**params)
        if set_default:
            await stripe_lib.Product.modify_async(
                product,
                default_price=price.id,
                idempotency_key=f"{idempotency_key}_set_default"
                if idempotency_key is not None
                else None,
            )
        return price

    async def update_product(
        self, product: str, **kwargs: Unpack[stripe_lib.Product.ModifyParams]
    ) -> stripe_lib.Product:
        return await stripe_lib.Product.modify_async(product, **kwargs)

    async def archive_product(self, id: str) -> stripe_lib.Product:
        return await stripe_lib.Product.modify_async(id, active=False)

    async def unarchive_product(self, id: str) -> stripe_lib.Product:
        return await stripe_lib.Product.modify_async(id, active=True)

    async def archive_price(self, id: str) -> stripe_lib.Price:
        return await stripe_lib.Price.modify_async(id, active=False)

    async def create_checkout_session(
        self,
        price: str,
        success_url: str,
        *,
        is_subscription: bool,
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
            "mode": "subscription" if is_subscription else "payment",
            "automatic_tax": {"enabled": is_tax_applicable},
            "tax_id_collection": {"enabled": is_tax_applicable},
            "metadata": metadata or {},
        }
        if is_subscription:
            create_params["payment_method_collection"] = "if_required"
            if subscription_metadata is not None:
                create_params["subscription_data"] = {"metadata": subscription_metadata}
        else:
            create_params["invoice_creation"] = {
                "enabled": True,
                "invoice_data": {
                    "metadata": metadata or {},
                },
            }
        if customer is not None:
            create_params["customer"] = customer
            create_params["customer_update"] = {"name": "auto", "address": "auto"}
        if customer_email is not None:
            create_params["customer_email"] = customer_email

        return await stripe_lib.checkout.Session.create_async(**create_params)

    async def get_checkout_session(self, id: str) -> stripe_lib.checkout.Session:
        return await stripe_lib.checkout.Session.retrieve_async(id)

    async def get_checkout_session_by_payment_intent(
        self, payment_intent: str
    ) -> stripe_lib.checkout.Session | None:
        sessions = await stripe_lib.checkout.Session.list_async(
            payment_intent=payment_intent
        )
        for session in sessions:
            return session
        return None

    async def update_subscription_price(
        self, id: str, *, old_price: str, new_price: str
    ) -> stripe_lib.Subscription:
        subscription = await stripe_lib.Subscription.retrieve_async(id)

        old_items = subscription["items"]
        new_items: list[stripe_lib.Subscription.ModifyParamsItem] = []
        for item in old_items:
            if item.price.id == old_price:
                new_items.append({"id": item.id, "deleted": True})
        new_items.append({"price": new_price, "quantity": 1})

        return await stripe_lib.Subscription.modify_async(id, items=new_items)

    async def cancel_subscription(self, id: str) -> stripe_lib.Subscription:
        return await stripe_lib.Subscription.modify_async(
            id,
            cancel_at_period_end=True,
        )

    async def update_invoice(
        self, id: str, *, metadata: dict[str, str] | None = None
    ) -> stripe_lib.Invoice:
        return await stripe_lib.Invoice.modify_async(id, metadata=metadata or {})

    async def get_balance_transaction(self, id: str) -> stripe_lib.BalanceTransaction:
        return await stripe_lib.BalanceTransaction.retrieve_async(id)

    async def get_invoice(self, id: str) -> stripe_lib.Invoice:
        return await stripe_lib.Invoice.retrieve_async(
            id, expand=["total_tax_amounts.tax_rate"]
        )

    async def list_balance_transactions(
        self,
        *,
        account_id: str | None = None,
        payout: str | None = None,
        type: str | None = None,
    ) -> AsyncIterator[stripe_lib.BalanceTransaction]:
        params: stripe_lib.BalanceTransaction.ListParams = {
            "limit": 100,
            "stripe_account": account_id,
            "expand": ["data.source"],
        }
        if payout is not None:
            params["payout"] = payout
        if type is not None:
            params["type"] = type

        result = await stripe_lib.BalanceTransaction.list_async(**params)
        return result.auto_paging_iter()

    async def list_refunds(
        self,
        *,
        charge: str | None = None,
    ) -> AsyncIterator[stripe_lib.Refund]:
        params: stripe_lib.Refund.ListParams = {"limit": 100}
        if charge is not None:
            params["charge"] = charge

        result = await stripe_lib.Refund.list_async(**params)
        return result.auto_paging_iter()

    async def get_charge(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Charge:
        return await stripe_lib.Charge.retrieve_async(
            id, stripe_account=stripe_account, expand=expand or []
        )

    async def get_refund(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Refund:
        return await stripe_lib.Refund.retrieve_async(
            id, stripe_account=stripe_account, expand=expand or []
        )

    async def get_dispute(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Dispute:
        return await stripe_lib.Dispute.retrieve_async(
            id, stripe_account=stripe_account, expand=expand or []
        )

    async def create_payout(
        self,
        *,
        stripe_account: str,
        amount: int,
        currency: str,
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Payout:
        return await stripe_lib.Payout.create_async(
            stripe_account=stripe_account,
            amount=amount,
            currency=currency,
            metadata=metadata or {},
        )

    async def create_payment_intent(
        self, **params: Unpack[stripe_lib.PaymentIntent.CreateParams]
    ) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.create_async(**params)

    async def get_payment_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.retrieve_async(id)

    async def create_customer(
        self, **params: Unpack[stripe_lib.Customer.CreateParams]
    ) -> stripe_lib.Customer:
        return await stripe_lib.Customer.create_async(**params)

    async def update_customer(
        self,
        id: str,
        tax_id: stripe_lib.Customer.CreateParamsTaxIdDatum | None = None,
        **params: Unpack[stripe_lib.Customer.ModifyParams],
    ) -> stripe_lib.Customer:
        if tax_id is not None:
            await stripe_lib.Customer.create_tax_id_async(id, **tax_id)

        customer = await stripe_lib.Customer.modify_async(id, **params)

        return customer

    async def create_customer_session(
        self, customer_id: str
    ) -> stripe_lib.CustomerSession:
        return await stripe_lib.CustomerSession.create_async(
            components={
                "payment_element": {
                    "enabled": True,
                    "features": {
                        "payment_method_allow_redisplay_filters": [
                            "always",
                            "limited",
                            "unspecified",
                        ],
                        "payment_method_redisplay": "enabled",
                    },
                }
            },
            customer=customer_id,
        )

    async def create_out_of_band_subscription(
        self,
        *,
        customer: str,
        currency: str,
        price: str,
        automatic_tax: bool = True,
        metadata: dict[str, str] | None = None,
        invoice_metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[stripe_lib.Subscription, stripe_lib.Invoice]:
        subscription = await stripe_lib.Subscription.create_async(
            customer=customer,
            currency=currency,
            collection_method="send_invoice",
            days_until_due=0,
            items=[{"price": price, "quantity": 1}],
            metadata=metadata or {},
            automatic_tax={"enabled": automatic_tax},
            expand=["latest_invoice"],
            idempotency_key=idempotency_key,
        )

        if subscription.latest_invoice is None:
            raise MissingLatestInvoiceForOutofBandSubscription(subscription.id)

        invoice = cast(stripe_lib.Invoice, subscription.latest_invoice)
        invoice_id = get_expandable_id(invoice)
        invoice = await stripe_lib.Invoice.modify_async(
            invoice_id,
            metadata=invoice_metadata or {},
            idempotency_key=f"{idempotency_key}_update_invoice"
            if idempotency_key is not None
            else None,
        )
        invoice = await stripe_lib.Invoice.finalize_invoice_async(
            invoice_id,
            idempotency_key=f"{idempotency_key}_finalize_invoice"
            if idempotency_key is not None
            else None,
        )

        if invoice.status == "open":
            await stripe_lib.Invoice.pay_async(
                invoice_id,
                paid_out_of_band=True,
                idempotency_key=f"{idempotency_key}_pay_invoice"
                if idempotency_key is not None
                else None,
            )

        return subscription, invoice

    async def set_automatically_charged_subscription(
        self,
        subscription_id: str,
        payment_method: str | None,
        *,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Subscription:
        params: stripe_lib.Subscription.ModifyParams = {
            "collection_method": "charge_automatically",
            "idempotency_key": idempotency_key,
        }
        if payment_method is not None:
            params["default_payment_method"] = payment_method
        return await stripe_lib.Subscription.modify_async(subscription_id, **params)

    async def create_out_of_band_invoice(
        self,
        *,
        customer: str,
        currency: str,
        price: str,
        automatic_tax: bool = True,
        metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Invoice:
        invoice = await stripe_lib.Invoice.create_async(
            auto_advance=True,
            collection_method="send_invoice",
            days_until_due=0,
            customer=customer,
            metadata=metadata or {},
            automatic_tax={"enabled": automatic_tax},
            currency=currency,
            idempotency_key=f"{idempotency_key}_invoice" if idempotency_key else None,
        )
        invoice_id = cast(str, invoice.id)

        await stripe_lib.InvoiceItem.create_async(
            customer=customer,
            currency=currency,
            price=price,
            invoice=invoice_id,
            quantity=1,
            idempotency_key=f"{idempotency_key}_invoice_item"
            if idempotency_key
            else None,
        )

        invoice = await stripe_lib.Invoice.finalize_invoice_async(
            invoice_id,
            idempotency_key=f"{idempotency_key}_finalize_invoice"
            if idempotency_key
            else None,
        )

        if invoice.status == "open":
            await stripe_lib.Invoice.pay_async(
                invoice_id,
                paid_out_of_band=True,
                idempotency_key=f"{idempotency_key}_pay_invoice"
                if idempotency_key
                else None,
            )

        return invoice

    async def create_tax_calculation(
        self,
        **params: Unpack[stripe_lib.tax.Calculation.CreateParams],
    ) -> stripe_lib.tax.Calculation:
        return await stripe_lib.tax.Calculation.create_async(**params)


stripe = StripeService()
