"""Onboarding tracking schemas."""

from enum import StrEnum

from pydantic import Field

from polar.kit.schemas import Schema


class OnboardingStep(StrEnum):
    """Onboarding step identifiers."""

    ORG = "org"
    PRODUCT = "product"
    INTEGRATE = "integrate"


class SignupMethod(StrEnum):
    """User signup method."""

    GITHUB = "github"
    GOOGLE = "google"
    EMAIL = "email"


class OnboardingSessionState(Schema):
    """
    Onboarding session state stored in cookie.
    Passed from frontend to backend to track progress.
    """

    session_id: str = Field(description="Unique ID for this onboarding attempt")
    started_at: str = Field(description="ISO timestamp when onboarding started")
    current_step: OnboardingStep = Field(description="Current step in onboarding flow")
    steps_completed: int = Field(default=0, description="Number of steps completed")
    signup_method: SignupMethod = Field(description="How the user signed up")

    # Experiment tracking
    experiment_name: str | None = Field(
        default=None, description="Active experiment name"
    )
    experiment_variant: str | None = Field(
        default=None, description="Assigned experiment variant"
    )


class OnboardingStartRequest(Schema):
    """Request to start onboarding tracking."""

    distinct_id: str | None = Field(
        default=None,
        description="PostHog distinct ID from the frontend for session reconciliation.",
    )
    signup_method: SignupMethod = Field(description="How the user signed up")
    session_id: str | None = Field(
        default=None,
        description="Existing session ID if resuming within 24h window.",
    )
    started_at: str | None = Field(
        default=None,
        description="Original start timestamp if resuming.",
    )

    experiment_name: str | None = Field(
        default=None,
        description="Experiment name (e.g., 'onboarding_experiment').",
    )
    experiment_variant: str | None = Field(
        default=None,
        description="Assigned variant (e.g., 'control', 'treatment').",
    )


class OnboardingStepRequest(Schema):
    """Request to track a step event."""

    session_id: str = Field(description="Onboarding session ID")
    organization_id: str | None = Field(
        default=None,
        description="Organization ID (set after org creation step).",
    )
    experiment_variant: str | None = Field(
        default=None,
        description="Experiment variant for filtering step events.",
    )


class OnboardingCompleteRequest(Schema):
    """Request to mark onboarding as complete."""

    session_id: str = Field(description="Onboarding session ID")
    organization_id: str = Field(description="Created organization ID")
    experiment_variant: str | None = Field(
        default=None,
        description="Experiment variant for filtering completion events.",
    )


class OnboardingSessionResponse(Schema):
    """Response with session state for cookie storage."""

    session_id: str
    started_at: str
    current_step: OnboardingStep
    steps_completed: int
    signup_method: SignupMethod
    experiment_name: str | None = None
    experiment_variant: str | None = None
