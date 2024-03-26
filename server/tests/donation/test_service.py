from typing import Any

import pytest
import stripe
from arq import Retry
from pytest_mock import MockerFixture

from polar.account.service import account as account_service
from polar.authz.service import Authz
from polar.donation.service import donation_service
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.tasks import charge_succeeded, payment_intent_succeeded
from polar.kit.db.postgres import AsyncSession
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.transaction.service.transaction import transaction as transaction_service
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


@pytest.mark.asyncio
class TestDonations:
    async def test_payment_intent_succeeded(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # then
        session.expunge_all()

        payment_intent_id = "pi_TESTING"
        latest_charge = "py_TESTING"
        to_organization_id = str(organization.id)

        # The pickled/unpickled version of stripe.Events is not the same as the version
        # you can create by calling the constructor. Using construct_from to replicate
        # the unpickling process.
        #
        # In the future, it would be cool if we where in better control of the data format
        # passed over the queue.
        ev = stripe.Event.construct_from(
            values=get_payment_intent_succeeded(
                payment_intent_id=payment_intent_id,
                latest_charge=latest_charge,
                metadata={
                    "type": "donation",
                    "to_organization_id": to_organization_id,
                },
            ),
            key=None,
        )

        await payment_intent_succeeded(
            job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )

        # get
        donation = await donation_service.get_by_payment_id(session, payment_intent_id)
        assert donation

    async def test_charge_succeeded_before_payment_intent_throws(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # then
        session.expunge_all()

        payment_intent_id = "pi_TESTING"
        charge_id = "py_TESTING"
        to_organization_id = str(organization.id)

        ev = stripe.Event.construct_from(
            values=get_charge_succeeded(
                payment_intent_id=payment_intent_id,
                charge_id=charge_id,
                metadata={
                    "type": "donation",
                    "to_organization_id": to_organization_id,
                },
                balance_transaction_id="txn_TEST",
            ),
            key=None,
        )

        with pytest.raises(Retry):
            await charge_succeeded(
                job_context,
                event=ev,
                polar_context=PolarWorkerContext(),
            )

    async def _send_payment_intent_then_charge(
        self,
        job_context: JobContext,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        payment_intent_id = "pi_TESTING"
        latest_charge = "py_TESTING"
        to_organization_id = str(organization.id)
        metadata = {
            "type": "donation",
            "to_organization_id": to_organization_id,
        }
        balance_transaction_id = "txn_BALANCE_TESTING"

        def _stripe_get_charge(self: Any, id: str) -> stripe.Charge:
            assert id == latest_charge
            return stripe.Charge.construct_from(
                key=None,
                values=get_charge(
                    charge_id=id,
                    payment_intent_id=payment_intent_id,
                    metadata=metadata,
                    balance_transaction_id=balance_transaction_id,
                ),
            )

        mocker.patch(
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

        mocker.patch(
            "polar.integrations.stripe.service.StripeService.get_balance_transaction",
            _stripe_get_balance_transaction,
        )

        ev = stripe.Event.construct_from(
            values=get_payment_intent_succeeded(
                payment_intent_id=payment_intent_id,
                latest_charge=latest_charge,
                metadata=metadata,
            ),
            key=None,
        )

        await payment_intent_succeeded(
            job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )

        # charge success
        ev = stripe.Event.construct_from(
            values=get_charge_succeeded(
                payment_intent_id=payment_intent_id,
                charge_id=latest_charge,
                balance_transaction_id=balance_transaction_id,
                metadata={
                    "type": "donation",
                    "to_organization_id": to_organization_id,
                },
            ),
            key=None,
        )

        await charge_succeeded(
            job_context,
            event=ev,
            polar_context=PolarWorkerContext(),
        )

    async def test_account_balance(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
        open_collective_account: Account,
        mocker: MockerFixture,
        user: User,
    ) -> None:
        organization.account_id = open_collective_account.id
        session.add(organization)
        await session.commit()

        # then
        session.expunge_all()

        await self._send_payment_intent_then_charge(job_context, organization, mocker)

        # expect account balance
        summary = await transaction_service.get_summary(
            session, user, open_collective_account, await Authz.authz(session)
        )

        assert 1900 == summary.balance.amount  # $20 minus $1 fee
        assert 0 == summary.payout.amount

    async def test_held_balance(
        self,
        job_context: JobContext,
        session: AsyncSession,
        organization: Organization,
        mocker: MockerFixture,
        open_collective_account: Account,
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        await self._send_payment_intent_then_charge(job_context, organization, mocker)

        # expect held balance

        authz = await Authz.authz(session)

        # (account is not connected at this moment)
        summary = await transaction_service.get_summary(
            session, user, open_collective_account, authz
        )
        assert 0 == summary.balance.amount

        await organization_service.set_account(
            session,
            authz=authz,
            user=user,
            organization=organization,
            account_id=open_collective_account.id,
        )

        # get account again
        account = await account_service.get(session, open_collective_account.id)
        assert account

        # release balances
        released_tx = await held_balance_service.release_account(session, account)
        assert 1 == len(released_tx)

        # expect account balance
        summary = await transaction_service.get_summary(
            session, user, account, await Authz.authz(session)
        )

        assert 1900 == summary.balance.amount  # $20 minus $1 fee
        assert 0 == summary.payout.amount
