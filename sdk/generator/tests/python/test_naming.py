import pytest

from python.naming import operation_name, paginator_name, service_name


@pytest.mark.parametrize(
    ("method_name", "expected"),
    [
        ("list", "iter_list"),
        ("list_payment_methods", "iter_list_payment_methods"),
        ("list_webhook_endpoints", "iter_list_webhook_endpoints"),
    ],
)
def test_paginator_name(method_name: str, expected: str) -> None:
    assert paginator_name(method_name) == expected


def test_regular_operation_and_service_names() -> None:
    assert operation_name("get_state_external") == "get_state_external"
    assert service_name("CustomerPortal") == "customer_portal"
