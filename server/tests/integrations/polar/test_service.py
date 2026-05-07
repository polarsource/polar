import uuid
from decimal import Decimal

import pytest
from pytest_mock import MockerFixture

from polar.integrations.polar.service import polar_self

SELF_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
ORG_A = uuid.UUID("00000000-0000-0000-0000-00000000000a")


@pytest.fixture
def configured(mocker: MockerFixture) -> None:
    settings = mocker.patch("polar.integrations.polar.service.settings")
    settings.POLAR_SELF_ENABLED = True
    settings.POLAR_ORGANIZATION_ID = str(SELF_ORG_ID)


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
