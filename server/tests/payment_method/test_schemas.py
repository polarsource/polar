from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from polar.payment_method.schemas import (
    PaymentMethodCard,
    PaymentMethodGeneric,
    PaymentMethodKrCard,
    PaymentMethodTypeAdapter,
)


def build_payment_method_dict(
    type: str, method_metadata: dict[str, Any]
) -> dict[str, Any]:
    return {
        "id": uuid4(),
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "modified_at": None,
        "processor": "stripe",
        "customer_id": uuid4(),
        "type": type,
        "method_metadata": method_metadata,
    }


class TestPaymentMethodTypeAdapter:
    def test_card(self) -> None:
        payment_method = PaymentMethodTypeAdapter.validate_python(
            build_payment_method_dict(
                "card",
                {
                    "brand": "visa",
                    "last4": "4242",
                    "exp_month": 12,
                    "exp_year": 2030,
                },
            )
        )
        assert isinstance(payment_method, PaymentMethodCard)

    @pytest.mark.parametrize(
        "method_metadata",
        [
            {"brand": "kookmin", "last4": "1234"},
            {"brand": None, "last4": None},
        ],
    )
    def test_kr_card(self, method_metadata: dict[str, Any]) -> None:
        payment_method = PaymentMethodTypeAdapter.validate_python(
            build_payment_method_dict("kr_card", method_metadata)
        )
        assert isinstance(payment_method, PaymentMethodKrCard)

    def test_unknown_type_falls_back_to_generic(self) -> None:
        payment_method = PaymentMethodTypeAdapter.validate_python(
            build_payment_method_dict("paypal", {})
        )
        assert isinstance(payment_method, PaymentMethodGeneric)
