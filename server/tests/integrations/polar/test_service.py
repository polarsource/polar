import uuid
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
