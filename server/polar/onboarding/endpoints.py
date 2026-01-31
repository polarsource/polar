"""Onboarding tracking API endpoints."""

from typing import Annotated, Literal

from fastapi import Depends, Path, Query

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    OnboardingCompleteRequest,
    OnboardingSessionResponse,
    OnboardingStartRequest,
    OnboardingStep,
    OnboardingStepRequest,
)
from .service import OnboardingNotEligible, onboarding

router = APIRouter(prefix="/onboarding", tags=["onboarding", APITag.private])


StepPath = Annotated[
    Literal["org", "product", "integrate"],
    Path(description="The onboarding step."),
]


@router.post(
    "/started",
    response_model=OnboardingSessionResponse,
    summary="Track Onboarding Start",
    responses={
        200: {"description": "Onboarding session started or resumed."},
        400: {"description": "User not eligible (already has organizations)."},
    },
    include_in_schema=False,
)
async def track_started(
    request: OnboardingStartRequest,
    auth_subject: auth.OnboardingWrite,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OnboardingSessionResponse:
    """
    Track the start of onboarding for a new user.

    Validates the user has no existing organizations.
    If the user already has organizations, returns 400.

    If a session_id and started_at are provided and within the 24h window,
    the existing session is resumed (no new start event fired).
    """
    try:
        return await onboarding.start(session, auth_subject.subject.id, request)
    except OnboardingNotEligible as e:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=e.message)


@router.post(
    "/step/{step}/started",
    status_code=204,
    summary="Track Step Started",
    responses={
        204: {"description": "Step start tracked."},
    },
    include_in_schema=False,
)
async def track_step_started(
    step: StepPath,
    request: OnboardingStepRequest,
    auth_subject: auth.OnboardingWrite,
    distinct_id: str | None = Query(default=None, description="PostHog distinct ID"),
) -> None:
    """Track when a user enters an onboarding step."""
    onboarding.track_step_started(
        user_id=auth_subject.subject.id,
        step=OnboardingStep(step),
        request=request,
        distinct_id=distinct_id,
    )


@router.post(
    "/step/{step}/completed",
    status_code=204,
    summary="Track Step Completed",
    responses={
        204: {"description": "Step completion tracked."},
    },
    include_in_schema=False,
)
async def track_step_completed(
    step: StepPath,
    request: OnboardingStepRequest,
    auth_subject: auth.OnboardingWrite,
    distinct_id: str | None = Query(default=None, description="PostHog distinct ID"),
) -> None:
    """Track when a user completes an onboarding step."""
    onboarding.track_step_completed(
        user_id=auth_subject.subject.id,
        step=OnboardingStep(step),
        request=request,
        distinct_id=distinct_id,
    )


@router.post(
    "/step/{step}/skipped",
    status_code=204,
    summary="Track Step Skipped",
    responses={
        204: {"description": "Step skip tracked."},
    },
    include_in_schema=False,
)
async def track_step_skipped(
    step: StepPath,
    request: OnboardingStepRequest,
    auth_subject: auth.OnboardingWrite,
    distinct_id: str | None = Query(default=None, description="PostHog distinct ID"),
) -> None:
    """Track when a user skips an onboarding step."""
    onboarding.track_step_skipped(
        user_id=auth_subject.subject.id,
        step=OnboardingStep(step),
        request=request,
        distinct_id=distinct_id,
    )


@router.post(
    "/completed",
    status_code=204,
    summary="Track Onboarding Completed",
    responses={
        204: {"description": "Onboarding completion tracked."},
    },
    include_in_schema=False,
)
async def track_completed(
    request: OnboardingCompleteRequest,
    auth_subject: auth.OnboardingWrite,
    distinct_id: str | None = Query(default=None, description="PostHog distinct ID"),
) -> None:
    """Track when onboarding is completed (user lands on dashboard)."""
    onboarding.track_completed(
        user_id=auth_subject.subject.id,
        request=request,
        distinct_id=distinct_id,
    )
