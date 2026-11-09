from datetime import timedelta

from polar.event.system import SystemEvent, build_system_event
from polar.kit.utils import utc_now
from polar.models import Customer, Organization


class TestBuildSystemEvent:
    def test_without_timestamp(
        self, organization: Organization, customer: Customer
    ) -> None:
        event = build_system_event(
            SystemEvent.meter_reset, customer, organization, {"meter_id": "meter"}
        )

        assert event.timestamp == event.ingested_at

    def test_with_timestamp(
        self, organization: Organization, customer: Customer
    ) -> None:
        timestamp = utc_now() - timedelta(days=1)

        event = build_system_event(
            SystemEvent.meter_reset,
            customer,
            organization,
            {"meter_id": "meter"},
            timestamp=timestamp,
        )

        assert event.timestamp == timestamp
