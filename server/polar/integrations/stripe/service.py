import uuid
from collections.abc import AsyncGenerator, AsyncIterator, Sequence
from typing import TYPE_CHECKING, Literal, Unpack, cast, overload

import stripe as stripe_lib

from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarError
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.utils import utc_now
from polar.logfire import instrument_httpx

if TYPE_CHECKING:
    from polar.account.schemas import AccountCreate
    from polar.models import Product, ProductPrice, User

stripe_lib.api_key = settings.STRIPE_SECRET_KEY

stripe_http_client = stripe_lib.HTTPXClient(allow_sync_methods=True)
instrument_httpx(stripe_http_client._client_async)
stripe_lib.default_http_client = stripe_http_client


StripeCancellationReasons = Literal[
    "customer_service",
    "low_quality",
    "missing_features",
    "other",
    "switched_service",
    "too_complex",
    "too_expensive",
    "unused",
]


class StripeError(PolarError): ...


class MissingOrganizationBillingEmail(StripeError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization {organization_id} billing email is not set."
        super().__init__(message)


class MissingLatestInvoiceForOutofBandSubscription(StripeError):
    def __init__(self, subscription_id: str) -> None:
        self.subscription_id = subscription_id
        message = f"The subscription {subscription_id} does not have a latest invoice."
        super().__init__(message)


class MissingPaymentMethod(StripeError):
    def __init__(self, subscription_id: str) -> None:
        self.subscription_id = subscription_id
        message = (
            f"Tried to upgrade subscription {subscription_id} "
            "but the customer has no attached payment method."
        )
        super().__init__(message, 400)


class StripeService:
    async def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.retrieve_async(id)

    async def create_account(
        self, account: "AccountCreate", name: str | None
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
            f"/v1/integrations/stripe/refresh?return_path={return_path}"
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
        idempotency_key: str | None = None,
    ) -> stripe_lib.Price:
        params = {**params, "product": product}
        if idempotency_key is not None:
            params["idempotency_key"] = idempotency_key
        return await stripe_lib.Price.create_async(**params)

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

    async def create_ad_hoc_custom_price(
        self,
        product: "Product",
        product_price: "ProductPrice",
        amount: int,
        currency: str,
        *,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Price:
        assert product.stripe_product_id is not None
        price_params: stripe_lib.Price.CreateParams = {
            "unit_amount": amount,
            "currency": currency,
            "metadata": {
                "product_price_id": str(product_price.id),
            },
        }

        if product.is_recurring:
            recurring_interval: SubscriptionRecurringInterval
            if product_price.legacy_recurring_interval:
                recurring_interval = product_price.legacy_recurring_interval
            else:
                assert product.recurring_interval is not None
                recurring_interval = product.recurring_interval
            price_params["recurring"] = {
                "interval": recurring_interval.as_literal(),
            }

        return await self.create_price_for_product(
            product.stripe_product_id,
            price_params,
            idempotency_key=idempotency_key,
        )

    async def create_placeholder_price(
        self,
        product: "Product",
        currency: str,
        *,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Price:
        assert product.stripe_product_id is not None
        price_params: stripe_lib.Price.CreateParams = {
            "unit_amount": 0,
            "currency": currency,
            "metadata": {
                "product_id": str(product.id),
            },
        }

        if product.is_recurring:
            assert product.recurring_interval is not None
            recurring_interval = product.recurring_interval
            price_params["recurring"] = {
                "interval": recurring_interval.as_literal(),
            }

        return await self.create_price_for_product(
            product.stripe_product_id,
            price_params,
            idempotency_key=idempotency_key,
        )

    async def update_subscription_price(
        self,
        id: str,
        *,
        new_prices: list[str],
        proration_behavior: Literal["always_invoice", "create_prorations", "none"],
        metadata: dict[str, str],
    ) -> stripe_lib.Subscription:
        subscription = await stripe_lib.Subscription.retrieve_async(id)

        old_items = subscription["items"]
        new_items: list[stripe_lib.Subscription.ModifyParamsItem] = []
        found_new_prices: set[str] = set()
        for item in old_items:
            if item.price.id not in new_prices:
                new_items.append({"id": item.id, "deleted": True})
            else:
                new_items.append({"id": item.id, "deleted": False})
                found_new_prices.add(item.price.id)
        for new_price in new_prices:
            if new_price not in found_new_prices:
                new_items.append({"price": new_price, "quantity": 1})

        try:
            return await stripe_lib.Subscription.modify_async(
                id,
                items=new_items,
                proration_behavior=proration_behavior,
                metadata=metadata,
            )
        except stripe_lib.InvalidRequestError as e:
            error = e.error
            if (
                error is not None
                and error.code == "resource_missing"
                and error.message is not None
                and "payment method" in error.message.lower()
            ):
                raise MissingPaymentMethod(id)
            raise

    async def update_subscription_discount(
        self, id: str, old_coupon: str | None, new_coupon: str | None
    ) -> stripe_lib.Subscription:
        if old_coupon is not None:
            await stripe_lib.Subscription.delete_discount_async(id)

        modify_discount_params: list[stripe_lib.Subscription.ModifyParamsDiscount] = []
        if new_coupon is not None:
            modify_discount_params.append({"coupon": new_coupon})

        return await stripe_lib.Subscription.modify_async(
            id, discounts=modify_discount_params
        )

    async def uncancel_subscription(self, id: str) -> stripe_lib.Subscription:
        return await stripe_lib.Subscription.modify_async(
            id,
            cancel_at_period_end=False,
        )

    async def cancel_subscription(
        self,
        id: str,
        customer_reason: StripeCancellationReasons | None = None,
        customer_comment: str | None = None,
    ) -> stripe_lib.Subscription:
        return await stripe_lib.Subscription.modify_async(
            id,
            cancel_at_period_end=True,
            cancellation_details=self._generate_subscription_cancellation_details(
                customer_reason=customer_reason,
                customer_comment=customer_comment,
            ),
        )

    async def revoke_subscription(
        self,
        id: str,
        customer_reason: StripeCancellationReasons | None = None,
        customer_comment: str | None = None,
    ) -> stripe_lib.Subscription:
        return await stripe_lib.Subscription.cancel_async(
            id,
            cancellation_details=self._generate_subscription_cancellation_details(
                customer_reason=customer_reason,
                customer_comment=customer_comment,
            ),
        )

    def _generate_subscription_cancellation_details(
        self,
        customer_reason: StripeCancellationReasons | None = None,
        customer_comment: str | None = None,
    ) -> stripe_lib.Subscription.ModifyParamsCancellationDetails:
        details: stripe_lib.Subscription.ModifyParamsCancellationDetails = {}
        if customer_reason:
            details["feedback"] = customer_reason

        if customer_comment:
            details["comment"] = customer_comment

        return details

    async def update_invoice(
        self, id: str, **params: Unpack[stripe_lib.Invoice.ModifyParams]
    ) -> stripe_lib.Invoice:
        return await stripe_lib.Invoice.modify_async(id, **params)

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

    async def create_refund(
        self,
        *,
        charge_id: str,
        amount: int,
        reason: Literal["duplicate", "requested_by_customer"],
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Refund:
        stripe_metadata: Literal[""] | dict[str, str] = ""
        if metadata is not None:
            stripe_metadata = metadata

        return await stripe_lib.Refund.create_async(
            charge=charge_id,
            amount=amount,
            reason=reason,
            metadata=stripe_metadata,
        )

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

    async def create_setup_intent(
        self, **params: Unpack[stripe_lib.SetupIntent.CreateParams]
    ) -> stripe_lib.SetupIntent:
        return await stripe_lib.SetupIntent.create_async(**params)

    async def create_customer(
        self, **params: Unpack[stripe_lib.Customer.CreateParams]
    ) -> stripe_lib.Customer:
        if settings.USE_TEST_CLOCK:
            test_clock = await stripe_lib.test_helpers.TestClock.create_async(
                frozen_time=int(utc_now().timestamp())
            )
            params["test_clock"] = test_clock.id
        return await stripe_lib.Customer.create_async(**params)

    async def update_customer(
        self,
        id: str,
        tax_id: stripe_lib.Customer.CreateParamsTaxIdDatum | None = None,
        **params: Unpack[stripe_lib.Customer.ModifyParams],
    ) -> stripe_lib.Customer:
        params = {**params, "expand": ["tax_ids"]}
        customer = await stripe_lib.Customer.modify_async(id, **params)
        if tax_id is None:
            return customer

        if any(
            existing_tax_id.value == tax_id["value"]
            and existing_tax_id.type == tax_id["type"]
            for existing_tax_id in customer.tax_ids or []
        ):
            return customer

        try:
            await stripe_lib.Customer.create_tax_id_async(id, **tax_id)
        except stripe_lib.InvalidRequestError as e:
            # Potential race condition with Stripe not returning the new Tax ID
            # during our customer modification, but exists upon attempted
            # creation. Since the matching resource exists we can return vs. raise.
            if e.code != "resource_already_exists":
                raise e

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
        prices: Sequence[str],
        coupon: str | None = None,
        automatic_tax: bool = True,
        metadata: dict[str, str] | None = None,
        invoice_metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[stripe_lib.Subscription, stripe_lib.Invoice]:
        params: stripe_lib.Subscription.CreateParams = {
            "customer": customer,
            "currency": currency,
            "collection_method": "send_invoice",
            "days_until_due": 0,
            "items": [{"price": price, "quantity": 1} for price in prices],
            "metadata": metadata or {},
            "automatic_tax": {"enabled": automatic_tax},
            "expand": ["latest_invoice"],
            "idempotency_key": idempotency_key,
        }
        if coupon is not None:
            params["discounts"] = [{"coupon": coupon}]

        subscription = await stripe_lib.Subscription.create_async(**params)

        if subscription.latest_invoice is None:
            raise MissingLatestInvoiceForOutofBandSubscription(subscription.id)

        invoice = cast(stripe_lib.Invoice, subscription.latest_invoice)
        invoice_id = get_expandable_id(invoice)
        invoice = await self._pay_out_of_band_subscription_invoice(
            invoice_id, invoice_metadata, idempotency_key
        )
        return subscription, invoice

    async def update_out_of_band_subscription(
        self,
        *,
        subscription_id: str,
        new_prices: list[str],
        coupon: str | None = None,
        automatic_tax: bool = True,
        metadata: dict[str, str] | None = None,
        invoice_metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[stripe_lib.Subscription, stripe_lib.Invoice]:
        subscription = await stripe_lib.Subscription.retrieve_async(subscription_id)

        modify_params: stripe_lib.Subscription.ModifyParams = {
            "collection_method": "send_invoice",
            "days_until_due": 0,
            "automatic_tax": {"enabled": automatic_tax},
        }
        if coupon is not None:
            modify_params["discounts"] = [{"coupon": coupon}]
        if metadata is not None:
            modify_params["metadata"] = metadata
        if idempotency_key is not None:
            modify_params["idempotency_key"] = idempotency_key

        old_items = subscription["items"]
        new_items: list[stripe_lib.Subscription.ModifyParamsItem] = []
        found_new_prices: set[str] = set()
        for item in old_items:
            if item.price.id not in new_prices:
                new_items.append({"id": item.id, "deleted": True})
            else:
                new_items.append({"id": item.id, "deleted": False})
                found_new_prices.add(item.price.id)
        for new_price in new_prices:
            if new_price not in found_new_prices:
                new_items.append({"price": new_price, "quantity": 1})
        modify_params["items"] = new_items

        subscription = await stripe_lib.Subscription.modify_async(
            subscription_id, **modify_params
        )

        if subscription.latest_invoice is None:
            raise MissingLatestInvoiceForOutofBandSubscription(subscription.id)

        invoice = cast(stripe_lib.Invoice, subscription.latest_invoice)
        invoice_id = get_expandable_id(invoice)
        invoice = await self._pay_out_of_band_subscription_invoice(
            invoice_id, invoice_metadata, idempotency_key
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

    async def _pay_out_of_band_subscription_invoice(
        self,
        invoice_id: str,
        metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> stripe_lib.Invoice:
        invoice = await stripe_lib.Invoice.modify_async(
            invoice_id,
            metadata=metadata or {},
            idempotency_key=(
                f"{idempotency_key}_update_invoice"
                if idempotency_key is not None
                else None
            ),
        )
        invoice = await stripe_lib.Invoice.finalize_invoice_async(
            invoice_id,
            idempotency_key=(
                f"{idempotency_key}_finalize_invoice"
                if idempotency_key is not None
                else None
            ),
        )

        if invoice.status == "open":
            await stripe_lib.Invoice.pay_async(
                invoice_id,
                paid_out_of_band=True,
                idempotency_key=(
                    f"{idempotency_key}_pay_invoice"
                    if idempotency_key is not None
                    else None
                ),
            )

        return invoice

    async def create_out_of_band_invoice(
        self,
        *,
        customer: str,
        currency: str,
        prices: Sequence[str],
        coupon: str | None = None,
        automatic_tax: bool = True,
        metadata: dict[str, str] | None = None,
        idempotency_key: str | None = None,
    ) -> tuple[stripe_lib.Invoice, dict[str, stripe_lib.InvoiceLineItem]]:
        params: stripe_lib.Invoice.CreateParams = {
            "auto_advance": True,
            "collection_method": "send_invoice",
            "days_until_due": 0,
            "customer": customer,
            "metadata": metadata or {},
            "automatic_tax": {"enabled": automatic_tax},
            "currency": currency,
            "idempotency_key": (
                f"{idempotency_key}_invoice" if idempotency_key else None
            ),
        }
        if coupon is not None:
            params["discounts"] = [{"coupon": coupon}]

        invoice = await stripe_lib.Invoice.create_async(**params)
        invoice_id = cast(str, invoice.id)

        item_map: dict[str, tuple[str, stripe_lib.InvoiceItem]] = {}
        for price in prices:
            invoice_item = await stripe_lib.InvoiceItem.create_async(
                customer=customer,
                currency=currency,
                price=price,
                invoice=invoice_id,
                quantity=1,
                idempotency_key=(
                    f"{idempotency_key}_{price}_invoice_item"
                    if idempotency_key
                    else None
                ),
            )
            item_map[invoice_item.id] = (price, invoice_item)

        # Manually retrieve the invoice, as we've seen cases where finalization below
        # failed because the idempotency request returned us a draft invoice,
        # but the invoice was actually already finalized.
        invoice = await stripe_lib.Invoice.retrieve_async(
            invoice_id, expand=["total_tax_amounts.tax_rate"]
        )

        if invoice.status == "draft":
            invoice = await stripe_lib.Invoice.finalize_invoice_async(
                invoice_id,
                idempotency_key=(
                    f"{idempotency_key}_finalize_invoice" if idempotency_key else None
                ),
                expand=["total_tax_amounts.tax_rate"],
            )

        if invoice.status == "open":
            await stripe_lib.Invoice.pay_async(
                invoice_id,
                paid_out_of_band=True,
                idempotency_key=(
                    f"{idempotency_key}_pay_invoice" if idempotency_key else None
                ),
            )

        price_line_item_map = {}
        for line_item in invoice.lines.data:
            assert line_item.invoice_item is not None
            price_id, invoice_item = item_map[get_expandable_id(line_item.invoice_item)]
            price_line_item_map[price_id] = line_item

        return invoice, price_line_item_map

    async def create_invoice_item(
        self,
        *,
        customer: str,
        invoice: str,
        amount: int,
        currency: str,
        description: str,
        tax_behavior: Literal["exclusive", "inclusive"] = "exclusive",
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.InvoiceItem:
        return await stripe_lib.InvoiceItem.create_async(
            customer=customer,
            invoice=invoice,
            amount=amount,
            currency=currency,
            description=description,
            tax_behavior=tax_behavior,
            metadata=metadata or {},
        )

    async def create_tax_calculation(
        self,
        **params: Unpack[stripe_lib.tax.Calculation.CreateParams],
    ) -> stripe_lib.tax.Calculation:
        return await stripe_lib.tax.Calculation.create_async(**params)

    async def get_tax_calculation(self, id: str) -> stripe_lib.tax.Calculation:
        return await stripe_lib.tax.Calculation.retrieve_async(id)

    async def create_tax_transaction(
        self, calculation_id: str, reference: str
    ) -> stripe_lib.tax.Transaction:
        return await stripe_lib.tax.Transaction.create_from_calculation_async(
            calculation=calculation_id,
            reference=reference,
            idempotency_key=f"polar:tax_transaction:{reference}",
        )

    @overload
    async def revert_tax_transaction(
        self, original_transaction_id: str, mode: Literal["full"], reference: str
    ) -> stripe_lib.tax.Transaction: ...

    @overload
    async def revert_tax_transaction(
        self,
        original_transaction_id: str,
        mode: Literal["partial"],
        reference: str,
        amount: int,
    ) -> stripe_lib.tax.Transaction: ...

    async def revert_tax_transaction(
        self,
        original_transaction_id: str,
        mode: Literal["full", "partial"],
        reference: str,
        amount: int | None = None,
    ) -> stripe_lib.tax.Transaction:
        params: stripe_lib.tax.Transaction.CreateReversalParams = {
            "mode": mode,
            "original_transaction": original_transaction_id,
            "reference": reference,
            "idempotency_key": f"polar:tax_transaction_revert:{reference}",
        }
        if mode == "partial" and amount is not None:
            params["flat_amount"] = amount
        return await stripe_lib.tax.Transaction.create_reversal_async(**params)

    async def create_coupon(
        self, **params: Unpack[stripe_lib.Coupon.CreateParams]
    ) -> stripe_lib.Coupon:
        return await stripe_lib.Coupon.create_async(**params)

    async def update_coupon(
        self, id: str, **params: Unpack[stripe_lib.Coupon.ModifyParams]
    ) -> stripe_lib.Coupon:
        return await stripe_lib.Coupon.modify_async(id, **params)

    async def delete_coupon(self, id: str) -> stripe_lib.Coupon:
        return await stripe_lib.Coupon.delete_async(id)

    async def list_payment_methods(
        self, customer: str
    ) -> AsyncGenerator[stripe_lib.PaymentMethod]:
        payment_methods = await stripe_lib.Customer.list_payment_methods_async(customer)
        async for payment_method in payment_methods.auto_paging_iter():
            yield payment_method

    async def get_payment_method(
        self, payment_method_id: str
    ) -> stripe_lib.PaymentMethod:
        return await stripe_lib.PaymentMethod.retrieve_async(payment_method_id)

    async def delete_payment_method(
        self, payment_method_id: str
    ) -> stripe_lib.PaymentMethod:
        return await stripe_lib.PaymentMethod.detach_async(payment_method_id)

    async def get_verification_session(
        self, id: str
    ) -> stripe_lib.identity.VerificationSession:
        return await stripe_lib.identity.VerificationSession.retrieve_async(id)

    async def create_verification_session(
        self, user: "User"
    ) -> stripe_lib.identity.VerificationSession:
        return await stripe_lib.identity.VerificationSession.create_async(
            type="document",
            options={
                "document": {
                    "allowed_types": ["driving_license", "id_card", "passport"],
                    "require_live_capture": True,
                    "require_matching_selfie": True,
                }
            },
            provided_details={
                "email": user.email,
            },
            client_reference_id=str(user.id),
            metadata={"user_id": str(user.id)},
        )

    async def get_tax_rate(self, id: str) -> stripe_lib.TaxRate:
        return await stripe_lib.TaxRate.retrieve_async(id)


stripe = StripeService()
