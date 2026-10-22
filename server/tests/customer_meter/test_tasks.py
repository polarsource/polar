import uuid

from polar.customer_meter.tasks import (
    DEFAULT_LOOKBACK_HOURS,
    _update_customer_debounce_key,
)


class TestUpdateCustomerDebounceKey:
    def test_regular(self) -> None:
        customer_id = uuid.uuid4()

        assert (
            _update_customer_debounce_key(customer_id)
            == f"customer_meter.update_customer:{customer_id}"
        )

    def test_default_lookback(self) -> None:
        customer_id = uuid.uuid4()

        assert _update_customer_debounce_key(
            customer_id, lookback_hours=DEFAULT_LOOKBACK_HOURS
        ) == _update_customer_debounce_key(customer_id)

    def test_longer_lookback(self) -> None:
        assert _update_customer_debounce_key(uuid.uuid4(), lookback_hours=720) is None
