import uuid

import pytest
from pydantic import ValidationError

from polar.checkout.schemas import CheckoutConfirm, CheckoutProductsCreate


class TestCheckoutConfirmNulCharacter:
    def test_customer_name(self) -> None:
        with pytest.raises(ValidationError):
            CheckoutConfirm.model_validate({"customer_name": "Jo\x00hn"})

    def test_customer_billing_address_line1(self) -> None:
        with pytest.raises(ValidationError):
            CheckoutConfirm.model_validate(
                {
                    "customer_billing_address": {
                        "country": "US",
                        "state": "NY",
                        "line1": "Escocia str., 42, 2\x004,",
                    }
                }
            )

    def test_valid_input_is_accepted(self) -> None:
        confirm = CheckoutConfirm.model_validate(
            {
                "customer_name": "John Doe",
                "customer_billing_address": {
                    "country": "FR",
                    "line1": "1 rue de la Paix",
                },
            }
        )
        assert confirm.customer_name == "John Doe"
        assert confirm.customer_billing_address is not None
        assert confirm.customer_billing_address.line1 == "1 rue de la Paix"


class TestCheckoutCustomerMetadataNulCharacter:
    def test_customer_metadata_value(self) -> None:
        with pytest.raises(ValidationError):
            CheckoutProductsCreate.model_validate(
                {
                    "products": [str(uuid.uuid4())],
                    "customer_metadata": {"key": "va\x00lue"},
                }
            )
