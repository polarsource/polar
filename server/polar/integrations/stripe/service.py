from collections.abc import AsyncGenerator, AsyncIterator
from typing import TYPE_CHECKING, Literal, Unpack, cast, overload

import stripe as stripe_lib
import structlog

from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.logfire import instrument_httpx
from polar.logging import Logger

if TYPE_CHECKING:
    from polar.account.schemas import AccountCreateForOrganization
    from polar.models import User

stripe_lib.api_key = settings.STRIPE_SECRET_KEY

stripe_http_client = stripe_lib.HTTPXClient(allow_sync_methods=True)
instrument_httpx(stripe_http_client._client_async)
stripe_lib.default_http_client = stripe_http_client

log: Logger = structlog.get_logger()


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


class StripeService:
    async def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.retrieve_async(id)

    async def create_account(
        self, account: "AccountCreateForOrganization", name: str | None
    ) -> stripe_lib.Account:
        log.info(
            "stripe.account.create",
            country=account.country,
            name=name,
        )
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
        log.info(
            "stripe.account.update",
            account_id=id,
            name=name,
        )
        obj = {}
        if name:
            obj["business_profile"] = {"name": name}
        await stripe_lib.Account.modify_async(id, **obj)

    async def account_exists(self, id: str) -> bool:
        try:
            account = await stripe_lib.Account.retrieve_async(id)
            return bool(account)
        except stripe_lib.PermissionError:
            return False

    async def delete_account(self, id: str) -> stripe_lib.Account:
        # TODO: Check if this fails when account balance is non-zero
        log.info(
            "stripe.account.delete",
            account_id=id,
        )
        return await stripe_lib.Account.delete_async(id)

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
        idempotency_key: str | None = None,
    ) -> stripe_lib.Transfer:
        log.info(
            "stripe.transfer.create",
            destination_account=destination_stripe_id,
            amount=amount,
            currency="usd",
            source_transaction=source_transaction,
            transfer_group=transfer_group,
            idempotency_key=idempotency_key,
        )
        create_params: stripe_lib.Transfer.CreateParams = {
            "amount": amount,
            "currency": "usd",
            "destination": destination_stripe_id,
            "metadata": metadata or {},
            "idempotency_key": idempotency_key,
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
        expand: list[str] | None = None,
    ) -> AsyncIterator[stripe_lib.BalanceTransaction]:
        params: stripe_lib.BalanceTransaction.ListParams = {
            "limit": 100,
            "stripe_account": account_id,
        }
        if payout is not None:
            params["payout"] = payout
        if type is not None:
            params["type"] = type
        if expand is not None:
            params["expand"] = expand

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
        log.info(
            "stripe.refund.create",
            charge_id=charge_id,
            amount=amount,
            reason=reason,
        )
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
        log.info(
            "stripe.payout.create",
            account_id=stripe_account,
            amount=amount,
            currency=currency,
        )
        return await stripe_lib.Payout.create_async(
            stripe_account=stripe_account,
            amount=amount,
            currency=currency,
            metadata=metadata or {},
        )

    async def create_payment_intent(
        self, **params: Unpack[stripe_lib.PaymentIntent.CreateParams]
    ) -> stripe_lib.PaymentIntent:
        log.info(
            "stripe.payment_intent.create",
            amount=params.get("amount"),
            currency=params.get("currency"),
            customer=params.get("customer"),
        )
        return await stripe_lib.PaymentIntent.create_async(**params)

    async def get_payment_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return await stripe_lib.PaymentIntent.retrieve_async(id)

    async def create_setup_intent(
        self, **params: Unpack[stripe_lib.SetupIntent.CreateParams]
    ) -> stripe_lib.SetupIntent:
        log.info(
            "stripe.setup_intent.create",
            customer=params.get("customer"),
            usage=params.get("usage"),
        )
        return await stripe_lib.SetupIntent.create_async(**params)

    async def get_setup_intent(
        self, id: str, **params: Unpack[stripe_lib.SetupIntent.RetrieveParams]
    ) -> stripe_lib.SetupIntent:
        return await stripe_lib.SetupIntent.retrieve_async(id, **params)

    async def create_customer(
        self, **params: Unpack[stripe_lib.Customer.CreateParams]
    ) -> stripe_lib.Customer:
        log.info(
            "stripe.customer.create",
            email=params.get("email"),
            name=params.get("name"),
        )
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
        log.info(
            "stripe.customer.update",
            customer_id=id,
            email=params.get("email"),
            name=params.get("name"),
            tax_id_type=tax_id.get("type") if tax_id else None,
        )
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
        log.info(
            "stripe.tax.transaction.create",
            calculation_id=calculation_id,
            reference=reference,
        )
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
        log.info(
            "stripe.payment_method.delete",
            payment_method_id=payment_method_id,
        )
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

    async def redact_verification_session(
        self, id: str
    ) -> stripe_lib.identity.VerificationSession:
        log.info("stripe.identity.verification_session.redact", id=id)
        return await stripe_lib.identity.VerificationSession.redact_async(id)

    async def get_tax_rate(self, id: str) -> stripe_lib.TaxRate:
        return await stripe_lib.TaxRate.retrieve_async(id)


stripe = StripeService()
