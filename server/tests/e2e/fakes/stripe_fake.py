"""
Stateful Stripe fake for E2E billing tests.

This fake maintains state across operations to simulate realistic Stripe behavior
while remaining fast and deterministic. It tracks all created objects and their
state transitions, enabling assertions on what operations were performed.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal, Unpack
from unittest.mock import AsyncMock, MagicMock

import stripe as stripe_lib

from polar.integrations.stripe.service import StripeService
from tests.fixtures.stripe import (
    build_stripe_balance_transaction,
    build_stripe_charge,
    build_stripe_payment_intent,
    build_stripe_payment_method,
    build_stripe_refund,
    construct_stripe_customer,
)


@dataclass
class PaymentFailureConfig:
    """Configuration for simulating payment failures."""

    error_code: str
    decline_code: str | None = None
    message: str = "Your card was declined."


@dataclass
class StripeStatefulFake:
    """
    Stateful Stripe fake that simulates real Stripe behavior.

    Tracks all created objects and their state, enabling:
    - State verification in tests (e.g., "was a payment intent created?")
    - Realistic state transitions (e.g., payment_intent: requires_payment_method -> succeeded)
    - Error simulation for testing failure paths

    Usage:
        fake = StripeStatefulFake()
        # Configure failure for next payment
        fake.set_next_payment_failure("card_declined", "insufficient_funds")
        # Use fake in test...
        # Verify state
        assert len(fake.payment_intents) == 1
        assert fake.payment_intents["pi_1"].status == "succeeded"
    """

    # Storage for created objects
    customers: dict[str, stripe_lib.Customer] = field(default_factory=dict)
    payment_intents: dict[str, stripe_lib.PaymentIntent] = field(default_factory=dict)
    payment_methods: dict[str, stripe_lib.PaymentMethod] = field(default_factory=dict)
    charges: dict[str, stripe_lib.Charge] = field(default_factory=dict)
    refunds: dict[str, stripe_lib.Refund] = field(default_factory=dict)
    balance_transactions: dict[str, stripe_lib.BalanceTransaction] = field(
        default_factory=dict
    )
    tax_calculations: dict[str, stripe_lib.tax.Calculation] = field(
        default_factory=dict
    )
    tax_transactions: dict[str, stripe_lib.tax.Transaction] = field(
        default_factory=dict
    )

    # ID counters for generating unique IDs
    _id_counters: dict[str, int] = field(default_factory=dict)

    # Failure configuration
    _next_payment_failure: PaymentFailureConfig | None = None
    _permanent_payment_failure: PaymentFailureConfig | None = None

    # Call tracking for verification
    calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)

    def _next_id(self, prefix: str) -> str:
        """Generate a unique ID with the given prefix."""
        count = self._id_counters.get(prefix, 0) + 1
        self._id_counters[prefix] = count
        return f"{prefix}_{count:08d}"

    def _record_call(self, method: str, params: dict[str, Any]) -> None:
        """Record a method call for later verification."""
        self.calls.append((method, params))

    def reset(self) -> None:
        """Reset all state. Useful between test cases."""
        self.customers.clear()
        self.payment_intents.clear()
        self.payment_methods.clear()
        self.charges.clear()
        self.refunds.clear()
        self.balance_transactions.clear()
        self.tax_calculations.clear()
        self.tax_transactions.clear()
        self._id_counters.clear()
        self._next_payment_failure = None
        self._permanent_payment_failure = None
        self.calls.clear()

    # -------------------------------------------------------------------------
    # Failure simulation
    # -------------------------------------------------------------------------

    def set_next_payment_failure(
        self,
        error_code: str = "card_declined",
        decline_code: str | None = "insufficient_funds",
        message: str = "Your card was declined.",
    ) -> None:
        """Configure the next payment to fail. Clears after one use."""
        self._next_payment_failure = PaymentFailureConfig(
            error_code=error_code, decline_code=decline_code, message=message
        )

    def set_permanent_payment_failure(
        self,
        error_code: str = "card_declined",
        decline_code: str | None = "insufficient_funds",
        message: str = "Your card was declined.",
    ) -> None:
        """Configure all payments to fail until cleared."""
        self._permanent_payment_failure = PaymentFailureConfig(
            error_code=error_code, decline_code=decline_code, message=message
        )

    def clear_payment_failures(self) -> None:
        """Clear all payment failure configurations."""
        self._next_payment_failure = None
        self._permanent_payment_failure = None

    def _get_payment_failure(self) -> PaymentFailureConfig | None:
        """Get the current failure config, consuming one-time failures."""
        if self._next_payment_failure:
            failure = self._next_payment_failure
            self._next_payment_failure = None
            return failure
        return self._permanent_payment_failure

    # -------------------------------------------------------------------------
    # Customer operations
    # -------------------------------------------------------------------------

    async def create_customer(
        self, **params: Unpack[stripe_lib.Customer.CreateParams]
    ) -> stripe_lib.Customer:
        """Create a new customer."""
        self._record_call("create_customer", dict(params))
        customer_id = self._next_id("cus")
        customer = construct_stripe_customer(
            id=customer_id,
            email=params.get("email", "test@example.com"),
            name=params.get("name"),
        )
        self.customers[customer_id] = customer
        return customer

    async def get_customer(self, customer_id: str) -> stripe_lib.Customer:
        """Retrieve a customer by ID."""
        self._record_call("get_customer", {"customer_id": customer_id})
        if customer_id in self.customers:
            return self.customers[customer_id]
        # Return a default customer for IDs not created by this fake
        return construct_stripe_customer(id=customer_id)

    async def update_customer(
        self,
        customer_id: str,
        tax_id: stripe_lib.Customer.CreateParamsTaxIdDatum | None = None,
        **params: Unpack[stripe_lib.Customer.ModifyParams],
    ) -> stripe_lib.Customer:
        """Update a customer."""
        self._record_call(
            "update_customer", {"customer_id": customer_id, "tax_id": tax_id, **params}
        )
        customer = await self.get_customer(customer_id)
        # Update fields
        updated_data = {
            "id": customer.id,
            "email": params.get("email", customer.email),
            "name": params.get("name", customer.name),
            "address": customer.address,
        }
        updated = stripe_lib.Customer.construct_from(updated_data, None)
        self.customers[customer_id] = updated
        return updated

    # -------------------------------------------------------------------------
    # Payment Intent operations
    # -------------------------------------------------------------------------

    async def create_payment_intent(
        self, **params: Unpack[stripe_lib.PaymentIntent.CreateParams]
    ) -> stripe_lib.PaymentIntent:
        """Create a new payment intent."""
        self._record_call("create_payment_intent", dict(params))
        pi_id = self._next_id("pi")

        # Check if confirm=True and handle payment outcome
        confirm = params.get("confirm", False)
        status = "requires_payment_method"

        if confirm:
            failure = self._get_payment_failure()
            if failure:
                status = "requires_payment_method"
                # Create with error state
                pi = build_stripe_payment_intent(
                    id=pi_id,
                    amount=params["amount"],
                    currency=params.get("currency", "usd"),
                    customer=params.get("customer"),
                    status=status,
                    metadata=params.get("metadata"),
                    last_payment_error={
                        "code": failure.error_code,
                        "decline_code": failure.decline_code,
                        "message": failure.message,
                    },
                )
            else:
                # Success - create charge
                status = "succeeded"
                charge_id = self._next_id("ch")
                bt_id = self._next_id("txn")

                # Create balance transaction
                bt = build_stripe_balance_transaction(
                    amount=params["amount"],
                    currency=params.get("currency", "usd"),
                    fee=int(params["amount"] * 0.029) + 30,  # ~2.9% + 30c
                )
                # Override ID
                bt_data = dict(bt)
                bt_data["id"] = bt_id
                bt = stripe_lib.BalanceTransaction.construct_from(bt_data, None)
                self.balance_transactions[bt_id] = bt

                # Create charge with metadata from payment intent
                charge = build_stripe_charge(
                    id=charge_id,
                    status="succeeded",
                    amount=params["amount"],
                    currency=params.get("currency", "usd"),
                    customer=params.get("customer"),
                    payment_intent=pi_id,
                    balance_transaction=bt_id,
                    metadata=params.get("metadata"),
                )
                self.charges[charge_id] = charge

                pi = build_stripe_payment_intent(
                    id=pi_id,
                    amount=params["amount"],
                    currency=params.get("currency", "usd"),
                    customer=params.get("customer"),
                    status=status,
                    metadata=params.get("metadata"),
                    latest_charge=charge_id,
                )
        else:
            pi = build_stripe_payment_intent(
                id=pi_id,
                amount=params["amount"],
                currency=params.get("currency", "usd"),
                customer=params.get("customer"),
                status=status,
                metadata=params.get("metadata"),
            )

        self.payment_intents[pi_id] = pi
        return pi

    async def get_payment_intent(self, id: str) -> stripe_lib.PaymentIntent:
        """Retrieve a payment intent by ID."""
        self._record_call("get_payment_intent", {"id": id})
        if id in self.payment_intents:
            return self.payment_intents[id]
        # Return a default for unknown IDs
        return build_stripe_payment_intent(id=id)

    async def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        """Alias for get_payment_intent."""
        return await self.get_payment_intent(id)

    # -------------------------------------------------------------------------
    # Payment Method operations
    # -------------------------------------------------------------------------

    async def get_payment_method(
        self, payment_method_id: str
    ) -> stripe_lib.PaymentMethod:
        """Retrieve a payment method by ID."""
        self._record_call("get_payment_method", {"payment_method_id": payment_method_id})
        if payment_method_id in self.payment_methods:
            return self.payment_methods[payment_method_id]
        # Return a default card payment method
        return build_stripe_payment_method(
            type="card",
            customer=None,
            details={"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030},
        )

    async def list_payment_methods(
        self, customer: str
    ) -> AsyncIterator[stripe_lib.PaymentMethod]:
        """List payment methods for a customer."""
        self._record_call("list_payment_methods", {"customer": customer})
        for pm in self.payment_methods.values():
            if pm.customer == customer:
                yield pm

    async def delete_payment_method(
        self, payment_method_id: str
    ) -> stripe_lib.PaymentMethod:
        """Detach a payment method."""
        self._record_call("delete_payment_method", {"payment_method_id": payment_method_id})
        if payment_method_id in self.payment_methods:
            pm = self.payment_methods.pop(payment_method_id)
            return pm
        return build_stripe_payment_method()

    # -------------------------------------------------------------------------
    # Charge operations
    # -------------------------------------------------------------------------

    def create_charge_for_payment_intent(
        self,
        payment_intent_id: str,
        *,
        status: str = "succeeded",
    ) -> stripe_lib.Charge:
        """
        Create a charge for an existing payment intent.

        This is useful for simulating webhook flows where a charge
        is created after the payment intent is confirmed.

        Args:
            payment_intent_id: The ID of the payment intent
            status: The status of the charge (default: "succeeded")

        Returns:
            The created charge
        """
        if payment_intent_id not in self.payment_intents:
            raise ValueError(f"PaymentIntent {payment_intent_id} not found")

        pi = self.payment_intents[payment_intent_id]
        charge_id = self._next_id("ch")
        bt_id = self._next_id("txn")

        # Create balance transaction
        bt = build_stripe_balance_transaction(
            amount=pi.amount,
            currency=pi.currency,
            fee=int(pi.amount * 0.029) + 30,
        )
        bt_data = dict(bt)
        bt_data["id"] = bt_id
        bt = stripe_lib.BalanceTransaction.construct_from(bt_data, None)
        self.balance_transactions[bt_id] = bt

        # Create charge with metadata from payment intent
        charge = build_stripe_charge(
            id=charge_id,
            status=status,
            amount=pi.amount,
            currency=pi.currency,
            customer=pi.customer,
            payment_intent=payment_intent_id,
            balance_transaction=bt_id,
            metadata=dict(pi.metadata) if pi.metadata else None,
        )
        self.charges[charge_id] = charge

        # Update payment intent with latest charge
        pi_data = dict(pi)
        pi_data["latest_charge"] = charge_id
        if status == "succeeded":
            pi_data["status"] = "succeeded"
        updated_pi = stripe_lib.PaymentIntent.construct_from(pi_data, None)
        self.payment_intents[payment_intent_id] = updated_pi

        return charge

    async def get_charge(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Charge:
        """Retrieve a charge by ID."""
        self._record_call(
            "get_charge", {"id": id, "stripe_account": stripe_account, "expand": expand}
        )
        if id in self.charges:
            return self.charges[id]
        return build_stripe_charge(id=id)

    # -------------------------------------------------------------------------
    # Balance Transaction operations
    # -------------------------------------------------------------------------

    async def get_balance_transaction(self, id: str) -> stripe_lib.BalanceTransaction:
        """Retrieve a balance transaction by ID."""
        self._record_call("get_balance_transaction", {"id": id})
        if id in self.balance_transactions:
            return self.balance_transactions[id]
        return build_stripe_balance_transaction()

    # -------------------------------------------------------------------------
    # Refund operations
    # -------------------------------------------------------------------------

    async def create_refund(
        self,
        *,
        charge_id: str,
        amount: int,
        reason: Literal["duplicate", "requested_by_customer"],
        metadata: dict[str, str] | None = None,
    ) -> stripe_lib.Refund:
        """Create a refund."""
        self._record_call(
            "create_refund",
            {
                "charge_id": charge_id,
                "amount": amount,
                "reason": reason,
                "metadata": metadata,
            },
        )
        refund_id = self._next_id("re")
        bt_id = self._next_id("txn")

        # Create balance transaction for refund
        bt = build_stripe_balance_transaction(
            amount=-amount,
            currency="usd",
            fee=0,
        )
        bt_data = dict(bt)
        bt_data["id"] = bt_id
        bt = stripe_lib.BalanceTransaction.construct_from(bt_data, None)
        self.balance_transactions[bt_id] = bt

        refund = build_stripe_refund(
            id=refund_id,
            charge_id=charge_id,
            amount=amount,
            reason=reason,
            balance_transaction=bt_id,
            metadata=metadata,
        )
        self.refunds[refund_id] = refund
        return refund

    async def get_refund(
        self,
        id: str,
        *,
        stripe_account: str | None = None,
        expand: list[str] | None = None,
    ) -> stripe_lib.Refund:
        """Retrieve a refund by ID."""
        self._record_call(
            "get_refund", {"id": id, "stripe_account": stripe_account, "expand": expand}
        )
        if id in self.refunds:
            return self.refunds[id]
        return build_stripe_refund(id=id)

    # -------------------------------------------------------------------------
    # Tax operations
    # -------------------------------------------------------------------------

    async def create_tax_calculation(
        self,
        **params: Unpack[stripe_lib.tax.Calculation.CreateParams],
    ) -> stripe_lib.tax.Calculation:
        """Create a tax calculation."""
        self._record_call("create_tax_calculation", dict(params))
        calc_id = self._next_id("taxcalc")

        # Build a basic tax calculation response
        line_items = params.get("line_items", [])
        total_amount = sum(li.get("amount", 0) for li in line_items)
        # Default 10% tax for testing
        tax_amount = int(total_amount * 0.10)

        calc_data = {
            "id": calc_id,
            "object": "tax.calculation",
            "amount_total": total_amount + tax_amount,
            "currency": params.get("currency", "usd"),
            "tax_amount_exclusive": tax_amount,
            "tax_amount_inclusive": 0,
            "line_items": {
                "object": "list",
                "data": [
                    {
                        "id": f"li_{i}",
                        "amount": li.get("amount", 0),
                        "amount_tax": int(li.get("amount", 0) * 0.10),
                        "reference": li.get("reference"),
                    }
                    for i, li in enumerate(line_items)
                ],
            },
        }
        calc = stripe_lib.tax.Calculation.construct_from(calc_data, None)
        self.tax_calculations[calc_id] = calc
        return calc

    async def get_tax_calculation(self, id: str) -> stripe_lib.tax.Calculation:
        """Retrieve a tax calculation."""
        self._record_call("get_tax_calculation", {"id": id})
        if id in self.tax_calculations:
            return self.tax_calculations[id]
        raise stripe_lib.InvalidRequestError(
            message=f"No such tax calculation: {id}",
            param="id",
        )

    async def create_tax_transaction(
        self, calculation_id: str, reference: str
    ) -> stripe_lib.tax.Transaction:
        """Create a tax transaction from a calculation."""
        self._record_call(
            "create_tax_transaction",
            {"calculation_id": calculation_id, "reference": reference},
        )
        tx_id = self._next_id("taxtxn")
        tx_data = {
            "id": tx_id,
            "object": "tax.transaction",
            "calculation": calculation_id,
            "reference": reference,
        }
        tx = stripe_lib.tax.Transaction.construct_from(tx_data, None)
        self.tax_transactions[tx_id] = tx
        return tx

    async def revert_tax_transaction(
        self,
        original_transaction_id: str,
        mode: Literal["full", "partial"],
        reference: str,
        amount: int | None = None,
    ) -> stripe_lib.tax.Transaction:
        """Revert a tax transaction."""
        self._record_call(
            "revert_tax_transaction",
            {
                "original_transaction_id": original_transaction_id,
                "mode": mode,
                "reference": reference,
                "amount": amount,
            },
        )
        tx_id = self._next_id("taxtxn")
        tx_data = {
            "id": tx_id,
            "object": "tax.transaction",
            "type": "reversal",
            "original_transaction": original_transaction_id,
            "reference": reference,
        }
        tx = stripe_lib.tax.Transaction.construct_from(tx_data, None)
        self.tax_transactions[tx_id] = tx
        return tx

    # -------------------------------------------------------------------------
    # Setup Intent operations
    # -------------------------------------------------------------------------

    async def create_setup_intent(
        self, **params: Unpack[stripe_lib.SetupIntent.CreateParams]
    ) -> stripe_lib.SetupIntent:
        """Create a setup intent."""
        self._record_call("create_setup_intent", dict(params))
        si_id = self._next_id("seti")
        si_data = {
            "id": si_id,
            "object": "setup_intent",
            "status": "requires_payment_method",
            "customer": params.get("customer"),
            "client_secret": f"{si_id}_secret_test",
        }
        return stripe_lib.SetupIntent.construct_from(si_data, None)

    async def get_setup_intent(
        self, id: str, **params: Unpack[stripe_lib.SetupIntent.RetrieveParams]
    ) -> stripe_lib.SetupIntent:
        """Retrieve a setup intent."""
        self._record_call("get_setup_intent", {"id": id, **params})
        si_data = {
            "id": id,
            "object": "setup_intent",
            "status": "succeeded",
        }
        return stripe_lib.SetupIntent.construct_from(si_data, None)

    # -------------------------------------------------------------------------
    # Customer Session operations
    # -------------------------------------------------------------------------

    async def create_customer_session(
        self, customer_id: str
    ) -> stripe_lib.CustomerSession:
        """Create a customer session."""
        self._record_call("create_customer_session", {"customer_id": customer_id})
        cs_data = {
            "object": "customer_session",
            "client_secret": f"cuss_{self._next_id('cs')}_secret",
            "customer": customer_id,
        }
        return stripe_lib.CustomerSession.construct_from(cs_data, None)

    # -------------------------------------------------------------------------
    # Verification helpers
    # -------------------------------------------------------------------------

    def get_calls(self, method: str) -> list[dict[str, Any]]:
        """Get all calls to a specific method."""
        return [params for m, params in self.calls if m == method]

    def assert_called(self, method: str, times: int | None = None) -> None:
        """Assert a method was called, optionally a specific number of times."""
        calls = self.get_calls(method)
        if times is not None:
            assert len(calls) == times, (
                f"Expected {method} to be called {times} times, "
                f"but was called {len(calls)} times"
            )
        else:
            assert len(calls) > 0, f"Expected {method} to be called at least once"

    def assert_payment_intent_created(
        self, amount: int | None = None, currency: str | None = None
    ) -> stripe_lib.PaymentIntent:
        """Assert a payment intent was created with optional amount/currency check."""
        assert len(self.payment_intents) > 0, "No payment intents were created"
        pi = list(self.payment_intents.values())[-1]  # Get most recent
        if amount is not None:
            assert pi.amount == amount, f"Expected amount {amount}, got {pi.amount}"
        if currency is not None:
            assert pi.currency == currency, f"Expected currency {currency}, got {pi.currency}"
        return pi

    def get_total_charged_amount(self) -> int:
        """Get the total amount charged across all successful payment intents."""
        return sum(
            pi.amount
            for pi in self.payment_intents.values()
            if pi.status == "succeeded"
        )


def create_stripe_mock_from_fake(fake: StripeStatefulFake) -> MagicMock:
    """
    Create a MagicMock with spec=StripeService that delegates to the fake.

    This allows using the fake with existing code that patches stripe_service.
    """
    mock = MagicMock(spec=StripeService)

    # Wire up all methods to the fake
    mock.create_customer = AsyncMock(side_effect=fake.create_customer)
    mock.get_customer = AsyncMock(side_effect=fake.get_customer)
    mock.update_customer = AsyncMock(side_effect=fake.update_customer)
    mock.create_payment_intent = AsyncMock(side_effect=fake.create_payment_intent)
    mock.get_payment_intent = AsyncMock(side_effect=fake.get_payment_intent)
    mock.retrieve_intent = AsyncMock(side_effect=fake.retrieve_intent)
    mock.get_payment_method = AsyncMock(side_effect=fake.get_payment_method)
    mock.list_payment_methods = fake.list_payment_methods  # Already async generator
    mock.delete_payment_method = AsyncMock(side_effect=fake.delete_payment_method)
    mock.get_charge = AsyncMock(side_effect=fake.get_charge)
    mock.get_balance_transaction = AsyncMock(side_effect=fake.get_balance_transaction)
    mock.create_refund = AsyncMock(side_effect=fake.create_refund)
    mock.get_refund = AsyncMock(side_effect=fake.get_refund)
    mock.create_tax_calculation = AsyncMock(side_effect=fake.create_tax_calculation)
    mock.get_tax_calculation = AsyncMock(side_effect=fake.get_tax_calculation)
    mock.create_tax_transaction = AsyncMock(side_effect=fake.create_tax_transaction)
    mock.revert_tax_transaction = AsyncMock(side_effect=fake.revert_tax_transaction)
    mock.create_setup_intent = AsyncMock(side_effect=fake.create_setup_intent)
    mock.get_setup_intent = AsyncMock(side_effect=fake.get_setup_intent)
    mock.create_customer_session = AsyncMock(side_effect=fake.create_customer_session)

    return mock
