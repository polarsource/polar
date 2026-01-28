from datetime import UTC, datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.models import Organization, User, UserOrganization
from polar.onboarding.schemas import (
    OnboardingStartRequest,
    OnboardingStep,
    SignupMethod,
)
from polar.onboarding.service import OnboardingNotEligible, OnboardingService
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestStart:
    async def test_creates_session_and_fires_events(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """Test that a new session is created and PostHog events are fired."""
        posthog_mock = mocker.patch("polar.onboarding.service.posthog")

        request = OnboardingStartRequest(
            signup_method=SignupMethod.GITHUB,
            distinct_id="test-distinct-id",
            experiment_name="onboarding_flow_v1",
            experiment_variant="treatment",
        )

        response = await service.start(session, user.id, request)

        assert response.session_id is not None
        assert response.current_step == OnboardingStep.ORG
        assert response.experiment_variant == "treatment"

        assert posthog_mock.capture.call_count == 2

        exposure_call = posthog_mock.capture.call_args_list[0][1]
        assert exposure_call["event"] == "$feature_flag_called"
        assert exposure_call["properties"]["$feature_flag"] == "onboarding_flow_v1"

        started_call = posthog_mock.capture.call_args_list[1][1]
        assert started_call["event"] == "dashboard:onboarding:started"
        assert started_call["properties"]["$feature/onboarding_flow_v1"] == "treatment"
        assert "$insert_id" in started_call["properties"]

    async def test_resumes_session_within_24h_without_firing_events(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """Test that refreshing the page doesn't fire duplicate events."""
        posthog_mock = mocker.patch("polar.onboarding.service.posthog")

        existing_session_id = "existing-session-123"
        started_at = (datetime.now(UTC) - timedelta(hours=12)).isoformat()

        request = OnboardingStartRequest(
            signup_method=SignupMethod.GITHUB,
            session_id=existing_session_id,
            started_at=started_at,
            experiment_name="onboarding_flow_v1",
            experiment_variant="control",
        )

        response = await service.start(session, user.id, request)

        assert response.session_id == existing_session_id
        assert response.experiment_variant == "control"

        posthog_mock.capture.assert_not_called()

    async def test_user_with_existing_orgs_rejected(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that users with existing organizations cannot start onboarding tracking."""
        posthog_mock = mocker.patch("polar.onboarding.service.posthog")

        request = OnboardingStartRequest(signup_method=SignupMethod.GITHUB)

        with pytest.raises(OnboardingNotEligible):
            await service.start(session, user.id, request)

        posthog_mock.capture.assert_not_called()

    async def test_posthog_failure_does_not_break_flow(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        user: User,
    ) -> None:
        """Test that PostHog failures are caught and don't break the user flow."""
        posthog_mock = mocker.patch("polar.onboarding.service.posthog")
        posthog_mock.capture.side_effect = Exception("PostHog is down")
        log_mock = mocker.patch("polar.onboarding.service.log")

        request = OnboardingStartRequest(signup_method=SignupMethod.GITHUB)

        response = await service.start(session, user.id, request)

        assert response.session_id is not None
        log_mock.error.assert_called()


service = OnboardingService()
