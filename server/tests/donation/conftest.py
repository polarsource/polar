from typing import Any
from uuid import UUID

import pytest
import stripe
from pytest_mock import MockerFixture

from polar.integrations.stripe.schemas import DonationPaymentIntentMetadata, ProductType
from polar.integrations.stripe.tasks import charge_succeeded, payment_intent_succeeded
from polar.models.organization import Organization
from polar.worker import JobContext, PolarWorkerContext


def get_payment_intent_succeeded(
    *, payment_intent_id: str, latest_charge: str, metadata: dict[str, Any]
) -> dict[str, Any]:
    return {
        "api_version": "2022-11-15",
        "created": 1711383952,
        "data": {
            "object": {
                "amount": 2000,
                "amount_capturable": 0,
                "amount_details": {"tip": {}},
                "amount_received": 2000,
                "application": None,
                "application_fee_amount": None,
                "automatic_payment_methods": {
                    "allow_redirects": "always",
                    "enabled": True,
                },
                "canceled_at": None,
                "cancellation_reason": None,
                "capture_method": "automatic",
                "client_secret": "pi_xxxx_secret_xxxx",
                "confirmation_method": "automatic",
                "created": 1711383944,
                "currency": "usd",
                "customer": "cus_PhSTnJw6m0zmQI",
                "description": "Donation to zegl",
                "id": payment_intent_id,
                "invoice": None,
                "last_payment_error": None,
                "latest_charge": latest_charge,
                "livemode": False,
                "metadata": metadata,
                "next_action": None,
                "object": "payment_intent",
                "on_behalf_of": None,
                "payment_method": "pm_1OyGLJLDfyYwjoMW4iml3rE9",
                "payment_method_configuration_details": {
                    "id": "pmc_1NGM10LDfyYwjoMWIo4feCf4",
                    "parent": None,
                },
                "payment_method_options": {
                    "card": {
                        "installments": None,
                        "mandate_options": None,
                        "network": None,
                        "request_three_d_secure": "automatic",
                    },
                    "cashapp": {},
                    "link": {"persistent_token": None},
                },
                "payment_method_types": ["card", "link", "cashapp"],
                "processing": None,
                "receipt_email": "gustav@westling.dev",
                "review": None,
                "setup_future_usage": None,
                "shipping": None,
                "source": None,
                "statement_descriptor": None,
                "statement_descriptor_suffix": None,
                "status": "succeeded",
                "transfer_data": None,
                "transfer_group": None,
            }
        },
        "id": "evt_3OyGLELDfyYwjoMW1naAsjGo",
        "livemode": False,
        "object": "event",
        "pending_webhooks": 1,
        "request": {
            "id": "req_eADRp78MZ6C7c3",
            "idempotency_key": "e6568c7b-8d0b-450e-aba0-0cdb74b206a0",
        },
        "type": "payment_intent.succeeded",
    }


def get_charge(
    *,
    charge_id: str,
    payment_intent_id: str,
    metadata: dict[str, Any],
    balance_transaction_id: str,
) -> dict[str, Any]:
    return {
        "id": charge_id,
        "object": "charge",
        "amount": 1000,
        "amount_captured": 1000,
        "amount_refunded": 0,
        "application": None,
        "application_fee": None,
        "application_fee_amount": None,
        "balance_transaction": balance_transaction_id,
        "billing_details": {
            "address": {
                "city": None,
                "country": "SE",
                "line1": None,
                "line2": None,
                "postal_code": None,
                "state": None,
            },
            "email": "gustav@westling.dev",
            "name": None,
            "phone": None,
        },
        "calculated_statement_descriptor": None,
        "captured": True,
        "created": 1711446137,
        "currency": "usd",
        "customer": "cus_PhSTnJw6m0zmQI",
        "description": "Donation to zegl",
        "destination": None,
        "dispute": None,
        "disputed": False,
        "failure_balance_transaction": None,
        "failure_code": None,
        "failure_message": None,
        "fraud_details": {},
        "invoice": None,
        "livemode": False,
        "metadata": metadata,
        "on_behalf_of": None,
        "order": None,
        "outcome": {
            "network_status": "approved_by_network",
            "reason": None,
            "risk_level": "normal",
            "risk_score": 61,
            "seller_message": "Payment complete.",
            "type": "authorized",
        },
        "paid": True,
        "payment_intent": payment_intent_id,
        "payment_method": "pm_1OyWWJLDfyYwjoMWlfsTOWxk",
        "payment_method_details": {
            "link": {"country": "US"},
            "type": "link",
        },
        "radar_options": {},
        "receipt_email": "gustav@westling.dev",
        "receipt_number": None,
        "receipt_url": "https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xTW81U2pMRGZ5WXdqb01XKPqwirAGMgZCze43LuA6LBYo_N9r88s4yEBM9QFGQozBn1qSvn6IcdD1C3N_Xxen9VP6Qvi6rpNGtQbN",
        "refunded": False,
        "review": None,
        "shipping": None,
        "source": None,
        "source_transfer": None,
        "statement_descriptor": None,
        "statement_descriptor_suffix": None,
        "status": "succeeded",
        "transfer_data": None,
        "transfer_group": None,
    }


def get_charge_succeeded(
    *,
    charge_id: str,
    payment_intent_id: str,
    metadata: dict[str, Any],
    balance_transaction_id: str,
) -> dict[str, Any]:
    return {
        "id": "evt_3OyCqILDfyYwjoMW0WBO2wDF",
        "object": "event",
        "api_version": "2022-11-15",
        "created": 1711370501,
        "data": {
            "object": get_charge(
                charge_id=charge_id,
                payment_intent_id=payment_intent_id,
                metadata=metadata,
                balance_transaction_id=balance_transaction_id,
            )
        },
        "livemode": False,
        "pending_webhooks": 1,
        "request": {
            "id": "req_WumBUo9kofKNBI",
            "idempotency_key": "13828ae8-9224-47a9-acae-a4c013c79e0d",
        },
        "type": "charge.succeeded",
    }


def get_balance_transaction(*, id: str) -> dict[str, Any]:
    return {
        "id": id,
        "object": "balance_transaction",
        "amount": 2000,
        "available_on": 1712016000,
        "created": 1711446642,
        "currency": "usd",
        "description": "Donation to zegl",
        "exchange_rate": None,
        "fee": 39,
        "fee_details": [
            {
                "amount": 39,
                "application": None,
                "currency": "usd",
                "description": "Stripe processing fees",
                "type": "stripe_fee",
            }
        ],
        "net": 2000 - 39,
        "reporting_category": "charge",
        "source": "py_3OyWeMLDfyYwjoMW1yeWpehs",
        "status": "pending",
        "type": "payment",
    }


class DonationSender:
    organization: Organization
    mocker: MockerFixture
    job_context: JobContext

    def __init__(
        self,
        organization: Organization,
        mocker: MockerFixture,
        job_context: JobContext,
    ):
        self.organization = organization
        self.mocker = mocker
        self.job_context = job_context

    async def send_payment_intent_then_charge(
        self,
        *,
        payment_intent_id: str | None = None,
        latest_charge: str | None = None,
        balance_transaction_id: str | None = None,
        by_user_id: UUID | None = None,
        issue_id: UUID | None = None,
    ) -> None:
        payment_intent_id = payment_intent_id or "pi_TESTING"
        latest_charge = latest_charge or "py_TESTING"
        balance_transaction_id = balance_transaction_id or "txn_BALANCE_TESTING"

        metadata = DonationPaymentIntentMetadata(
            type=ProductType.donation,
            to_organization_id=self.organization.id,
        )

        if by_user_id:
            metadata.by_user_id = by_user_id

        if issue_id:
            metadata.issue_id = issue_id

        def _stripe_get_charge(self: Any, id: str) -> stripe.Charge:
            assert id == latest_charge
            return stripe.Charge.construct_from(
                key=None,
                values=get_charge(
                    charge_id=id,
                    payment_intent_id=payment_intent_id,
                    metadata=metadata.model_dump(exclude_none=True),
                    balance_transaction_id=balance_transaction_id,
                ),
            )

        self.mocker.patch(
            "polar.integrations.stripe.service.StripeService.get_charge",
            _stripe_get_charge,
        )

        def _stripe_get_balance_transaction(
            self: Any, id: str
        ) -> stripe.BalanceTransaction:
            assert id == balance_transaction_id
            return stripe.BalanceTransaction.construct_from(
                key=None,
                values=get_balance_transaction(
                    id=id,
                ),
            )

        self.mocker.patch(
            "polar.integrations.stripe.service.StripeService.get_balance_transaction",
            _stripe_get_balance_transaction,
        )

        ev = stripe.Event.construct_from(
            values=get_payment_intent_succeeded(
                payment_intent_id=payment_intent_id,
                latest_charge=latest_charge,
                metadata=metadata.model_dump(exclude_none=True),
            ),
            key=None,
        )

        await payment_intent_succeeded(
            self.job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )

        # charge success
        ev = stripe.Event.construct_from(
            values=get_charge_succeeded(
                payment_intent_id=payment_intent_id,
                charge_id=latest_charge,
                balance_transaction_id=balance_transaction_id,
                metadata=metadata.model_dump(exclude_none=True),
            ),
            key=None,
        )

        await charge_succeeded(
            self.job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )


@pytest.fixture(scope="function")
def donation_sender(
    job_context: JobContext,
    organization: Organization,
    mocker: MockerFixture,
) -> DonationSender:
    return DonationSender(
        organization=organization,
        mocker=mocker,
        job_context=job_context,
    )
