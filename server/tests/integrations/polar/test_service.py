import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.integrations.polar.service import polar_self
from polar.models.event import EventSource

SELF_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ORG_A = uuid.UUID("00000000-0000-0000-0000-00000000000a")
ORG_B = uuid.UUID("00000000-0000-0000-0000-00000000000b")


def _event(
    organization_id: uuid.UUID, source: EventSource = EventSource.user
) -> MagicMock:
    event = MagicMock()
    event.organization_id = organization_id
    event.source = source
    return event


@pytest.fixture
def configured(mocker: MockerFixture) -> None:
    settings = mocker.patch("polar.integrations.polar.service.settings")
    settings.POLAR_SELF_ENABLED = True
    settings.POLAR_ORGANIZATION_ID = str(SELF_ORG_ID)


class TestEnqueueEventIngestion:
    def test_noop_when_not_configured(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion([_event(ORG_A)])

        enqueue.assert_not_called()

    def test_noop_on_empty(self, configured: None, mocker: MockerFixture) -> None:
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion([])

        enqueue.assert_not_called()

    def test_aggregates_per_organization(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion(
            [
                _event(ORG_A),
                _event(ORG_A),
                _event(ORG_A),
                _event(ORG_B),
                _event(ORG_B),
            ]
        )

        assert enqueue.call_count == 2
        calls = {
            call.kwargs["external_customer_id"]: call.kwargs["count"]
            for call in enqueue.call_args_list
        }
        assert calls == {str(ORG_A): 3, str(ORG_B): 2}

    def test_skips_system_events(self, configured: None, mocker: MockerFixture) -> None:
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion(
            [
                _event(ORG_A, source=EventSource.user),
                _event(ORG_A, source=EventSource.system),
                _event(ORG_A, source=EventSource.system),
            ]
        )

        enqueue.assert_called_once_with(external_customer_id=str(ORG_A), count=1)

    def test_skips_self_organization(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion(
            [
                _event(SELF_ORG_ID),
                _event(SELF_ORG_ID),
                _event(ORG_A),
            ]
        )

        enqueue.assert_called_once_with(external_customer_id=str(ORG_A), count=1)

    def test_noop_when_only_self_org_events(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch(
            "polar.integrations.polar.service.polar_self.enqueue_track_ingestion"
        )

        polar_self.enqueue_event_ingestion([_event(SELF_ORG_ID), _event(SELF_ORG_ID)])

        enqueue.assert_not_called()


class TestEnqueueTrackOrganizationReviewUsage:
    def _call(
        self,
        *,
        external_customer_id: str = str(ORG_A),
        cost_usd: Decimal | float | None = Decimal("0.0123"),
    ) -> None:
        polar_self.enqueue_track_organization_review_usage(
            external_customer_id=external_customer_id,
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd=cost_usd,
        )

    def test_noop_when_not_configured(self, mocker: MockerFixture) -> None:
        settings = mocker.patch("polar.integrations.polar.service.settings")
        settings.POLAR_SELF_ENABLED = False
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call()

        enqueue.assert_not_called()

    def test_noop_for_self_organization(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(external_customer_id=str(SELF_ORG_ID))

        enqueue.assert_not_called()

    def test_noop_when_cost_is_none(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=None)

        enqueue.assert_not_called()

    def test_noop_when_cost_is_zero(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=Decimal(0))

        enqueue.assert_not_called()

    def test_enqueues_job_with_serialized_cost(
        self, configured: None, mocker: MockerFixture
    ) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=Decimal("0.0123"))

        enqueue.assert_called_once_with(
            "polar_self.track_organization_review_usage",
            external_customer_id=str(ORG_A),
            review_context="submission",
            vendor="openai",
            model="gpt-4o-mini",
            input_tokens=100,
            output_tokens=50,
            cost_usd="0.0123",
        )

    def test_accepts_float_cost(self, configured: None, mocker: MockerFixture) -> None:
        enqueue = mocker.patch("polar.integrations.polar.service.enqueue_job")

        self._call(cost_usd=0.5)

        assert enqueue.call_count == 1
        assert enqueue.call_args.kwargs["cost_usd"] == "0.5"
