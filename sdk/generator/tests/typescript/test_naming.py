import pytest

from typescript.naming import (
    exported_paginator_name,
    operation_name,
    paginator_name,
    service_name,
)


@pytest.mark.parametrize(
    ("method_name", "expected"),
    [
        ("list", "iterList"),
        ("list_payment_methods", "iterListPaymentMethods"),
        ("list_webhook_endpoints", "iterListWebhookEndpoints"),
    ],
)
def test_paginator_name(method_name: str, expected: str) -> None:
    assert paginator_name(method_name) == expected


def test_exported_paginator_name() -> None:
    assert (
        exported_paginator_name("list_payment_methods", "Customers")
        == "iterListPaymentMethodsCustomers"
    )


def test_regular_operation_and_service_names() -> None:
    assert operation_name("get_state_external") == "getStateExternal"
    assert service_name("CustomerPortal") == "customerPortal"
