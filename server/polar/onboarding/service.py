"""Onboarding tracking service."""

import uuid
from datetime import UTC, datetime, timedelta

import structlog

from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.posthog import posthog

from .schemas import (
    OnboardingCompleteRequest,
    OnboardingSessionResponse,
    OnboardingStartRequest,
    OnboardingStep,
    OnboardingStepRequest,
)

log = structlog.get_logger()

SESSION_TIMEOUT = timedelta(hours=24)


class OnboardingService:
    """
    Service for tracking onboarding funnel events.

    Uses PostHog for analytics with server-side event firing for reliability.
    Session state is managed via cookies on the frontend.
    """

    async def start(
        self,
        session: AsyncReadSession,
        user_id: uuid.UUID,
        request: OnboardingStartRequest,
    ) -> OnboardingSessionResponse:
        """
        Start onboarding tracking for a new user.

        Validates user has no existing organizations before allowing start.
        If resuming within 24h, continues the same session.
        """

        org_repo = OrganizationRepository.from_session(session)
        user_orgs = await org_repo.get_all_by_user(user_id)

        if len(user_orgs) > 0:
            raise OnboardingNotEligible("User already has organizations")

        now = datetime.now(UTC)

        if request.session_id and request.started_at:
            try:
                original_start = datetime.fromisoformat(request.started_at)
                if now - original_start < SESSION_TIMEOUT:
                    # Resume existing session - don't fire start event again
                    return OnboardingSessionResponse(
                        session_id=request.session_id,
                        started_at=request.started_at,
                        current_step=OnboardingStep.ORG,
                        steps_completed=0,
                        signup_method=request.signup_method,
                        experiment_name=request.experiment_name,
                        experiment_variant=request.experiment_variant,
                    )
            except (ValueError, TypeError):
                pass  # Invalid timestamp, start new session

        session_id = str(uuid.uuid4())
        started_at = now.isoformat()

        distinct_id = request.distinct_id or str(user_id)

        if request.experiment_name and request.experiment_variant:
            self._capture_experiment_exposure(
                distinct_id=distinct_id,
                experiment_name=request.experiment_name,
                variant=request.experiment_variant,
            )

        properties: dict[str, str | None] = {
            "user_id": str(user_id),
            "onboarding_session_id": session_id,
            "signup_method": request.signup_method.value,
        }
        if request.experiment_name:
            properties[f"$feature/{request.experiment_name}"] = request.experiment_variant

        self._capture_event(
            distinct_id=distinct_id,
            event="dashboard:onboarding:started",
            properties=properties,
            insert_id=f"{user_id}:{session_id}:started",
        )

        return OnboardingSessionResponse(
            session_id=session_id,
            started_at=started_at,
            current_step=OnboardingStep.ORG,
            steps_completed=0,
            signup_method=request.signup_method,
            experiment_name=request.experiment_name,
            experiment_variant=request.experiment_variant,
        )

    def track_step_started(
        self,
        user_id: uuid.UUID,
        step: OnboardingStep,
        request: OnboardingStepRequest,
        distinct_id: str | None = None,
    ) -> None:
        """Track when a user enters an onboarding step."""
        resolved_distinct_id = distinct_id or str(user_id)

        self._capture_event(
            distinct_id=resolved_distinct_id,
            event=f"dashboard:onboarding:step:{step.value}:started",
            properties={
                "user_id": str(user_id),
                "onboarding_session_id": request.session_id,
                "step": step.value,
                "organization_id": request.organization_id,
                "experiment_variant": request.experiment_variant,
            },
            insert_id=f"{user_id}:{request.session_id}:step:{step.value}:started",
        )

    def track_step_completed(
        self,
        user_id: uuid.UUID,
        step: OnboardingStep,
        request: OnboardingStepRequest,
        distinct_id: str | None = None,
    ) -> None:
        """Track when a user completes an onboarding step."""
        resolved_distinct_id = distinct_id or str(user_id)

        self._capture_event(
            distinct_id=resolved_distinct_id,
            event=f"dashboard:onboarding:step:{step.value}:completed",
            properties={
                "user_id": str(user_id),
                "onboarding_session_id": request.session_id,
                "step": step.value,
                "organization_id": request.organization_id,
                "experiment_variant": request.experiment_variant,
            },
            insert_id=f"{user_id}:{request.session_id}:step:{step.value}:completed",
        )

    def track_step_skipped(
        self,
        user_id: uuid.UUID,
        step: OnboardingStep,
        request: OnboardingStepRequest,
        distinct_id: str | None = None,
    ) -> None:
        """Track when a user skips an onboarding step."""
        resolved_distinct_id = distinct_id or str(user_id)

        self._capture_event(
            distinct_id=resolved_distinct_id,
            event=f"dashboard:onboarding:step:{step.value}:skipped",
            properties={
                "user_id": str(user_id),
                "onboarding_session_id": request.session_id,
                "step": step.value,
                "organization_id": request.organization_id,
                "experiment_variant": request.experiment_variant,
            },
            insert_id=f"{user_id}:{request.session_id}:step:{step.value}:skipped",
        )

    def track_completed(
        self,
        user_id: uuid.UUID,
        request: OnboardingCompleteRequest,
        distinct_id: str | None = None,
    ) -> None:
        """Track when onboarding is completed (user lands on dashboard)."""
        resolved_distinct_id = distinct_id or str(user_id)

        self._capture_event(
            distinct_id=resolved_distinct_id,
            event="dashboard:onboarding:completed",
            properties={
                "user_id": str(user_id),
                "onboarding_session_id": request.session_id,
                "organization_id": request.organization_id,
                "experiment_variant": request.experiment_variant,
            },
            insert_id=f"{user_id}:{request.session_id}:completed",
        )

    def _capture_event(
        self,
        distinct_id: str,
        event: str,
        properties: dict[str, str | None],
        insert_id: str,
    ) -> None:
        """
        Fire event to PostHog with error handling.

        Uses $insert_id for deduplication - PostHog will ignore
        duplicate events with the same insert_id.
        """
        try:
            posthog.capture(
                distinct_id=distinct_id,
                event=event,
                properties={
                    **properties,
                    "$insert_id": insert_id,
                },
            )
        except Exception as e:
            log.error(
                "Failed to capture PostHog onboarding event",
                event=event,
                error=str(e),
            )

    def _capture_experiment_exposure(
        self,
        distinct_id: str,
        experiment_name: str,
        variant: str,
    ) -> None:
        """
        Fire $feature_flag_called event to mark experiment exposure.

        This is fired atomically with the first onboarding event to ensure
        exposure count matches the funnel entry count exactly.
        """
        try:
            posthog.capture(
                distinct_id=distinct_id,
                event="$feature_flag_called",
                properties={
                    "$feature_flag": experiment_name,
                    "$feature_flag_response": variant,
                },
            )
        except Exception as e:
            log.error(
                "Failed to capture PostHog experiment exposure",
                experiment_name=experiment_name,
                error=str(e),
            )


class OnboardingNotEligible(Exception):
    """Raised when a user is not eligible for onboarding tracking."""

    def __init__(self, message: str = "User is not eligible for onboarding"):
        self.message = message
        super().__init__(self.message)


onboarding = OnboardingService()
