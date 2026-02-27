import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.integrations.plain.service import plain as plain_service
from polar.models.organization import Organization, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.organization.repository import (
    OrganizationRepository,
)
from polar.organization.repository import (
    OrganizationReviewRepository as OrgReviewRepository,
)
from polar.organization.service import organization as organization_service
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .agent import run_organization_review
from .report import build_agent_report
from .repository import OrganizationReviewRepository
from .schemas import ReviewContext, ReviewVerdict

log = structlog.get_logger(__name__)


class OrganizationReviewTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationReviewTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


# Mapping from agent verdict to OrganizationReview verdict
_VERDICT_MAP: dict[ReviewVerdict, str] = {
    ReviewVerdict.APPROVE: OrganizationReview.Verdict.PASS,
    ReviewVerdict.DENY: OrganizationReview.Verdict.FAIL,
}


@actor(
    actor_name="organization_review.run_agent",
    priority=TaskPriority.LOW,
    time_limit=180_000,  # 3 min timeout
    max_retries=1,
)
async def run_review_agent(
    organization_id: uuid.UUID,
    context: str = ReviewContext.THRESHOLD,
    auto_approve_eligible: bool = False,
) -> None:
    """Run the organization review agent as a background task.

    For SUBMISSION context: creates an OrganizationReview record and auto-denies on DENY.
    For THRESHOLD context: log-only, persists to OrganizationAgentReview table.
    """
    review_context = ReviewContext(context)

    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id,
            include_blocked=True,
            options=(joinedload(Organization.account),),
        )
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        # Run the review agent
        try:
            result = await run_organization_review(
                session, organization, context=review_context
            )
        except Exception:
            if review_context == ReviewContext.THRESHOLD and auto_approve_eligible:
                log.exception(
                    "organization_review.threshold.agent_failed",
                    organization_id=str(organization_id),
                    slug=organization.slug,
                )
                await plain_service.create_organization_review_thread(
                    session, organization
                )
                return
            raise

        report = result.report
        log.info(
            "organization_review.task.complete",
            organization_id=str(organization_id),
            slug=organization.slug,
            context=review_context.value,
            verdict=report.verdict.value,
            overall_risk_score=report.overall_risk_score,
            summary=report.summary,
            model_used=result.model_used,
            duration_seconds=result.duration_seconds,
            estimated_cost_usd=result.usage.estimated_cost_usd,
        )

        # Persist agent report to its own table (both contexts)
        review_repository = OrganizationReviewRepository.from_session(session)
        typed_report = build_agent_report(result, review_type=review_context.value)
        agent_review = await review_repository.save_agent_review(
            organization_id=organization_id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )

        # For THRESHOLD context with auto-approve eligibility:
        # delegate decision to the service layer
        if review_context == ReviewContext.THRESHOLD and auto_approve_eligible:
            auto_approved = await organization_service.handle_ongoing_review_verdict(
                session, organization, report.verdict
            )
            log.info(
                "organization_review.threshold.verdict_handled",
                organization_id=str(organization_id),
                slug=organization.slug,
                verdict=report.verdict.value,
                auto_approved=auto_approved,
            )
            if auto_approved:
                await review_repository.record_agent_decision(
                    organization_id=organization_id,
                    agent_review_id=agent_review.id,
                    decision="APPROVE",
                    review_context="threshold",
                    verdict=report.verdict.value,
                    risk_score=report.overall_risk_score,
                )

        # For SUBMISSION context: also create OrganizationReview record and act
        if review_context == ReviewContext.SUBMISSION:
            mapped_verdict = _VERDICT_MAP[report.verdict]

            org_review_repository = OrgReviewRepository.from_session(session)
            existing = await org_review_repository.get_by_organization(organization_id)
            if existing is None:
                org_review = OrganizationReview(
                    organization_id=organization_id,
                    verdict=mapped_verdict,
                    risk_score=report.overall_risk_score,
                    violated_sections=report.violated_sections,
                    reason=report.summary,
                    timed_out=result.timed_out,
                    organization_details_snapshot={
                        "name": organization.name,
                        "website": organization.website,
                        "details": organization.details,
                        "socials": organization.socials,
                    },
                    model_used=result.model_used,
                )
                session.add(org_review)

            # Auto-deny on DENY — human will review the denial
            if report.verdict == ReviewVerdict.DENY:
                organization.status = OrganizationStatus.DENIED
                organization.status_updated_at = datetime.now(UTC)
                session.add(organization)

                await review_repository.record_agent_decision(
                    organization_id=organization_id,
                    agent_review_id=agent_review.id,
                    decision="DENY",
                    review_context="submission",
                    verdict=report.verdict.value,
                    risk_score=report.overall_risk_score,
                )

                log.info(
                    "organization_review.submission.denied",
                    organization_id=str(organization_id),
                    slug=organization.slug,
                    verdict=report.verdict.value,
                )

        # For SETUP_COMPLETE context: hold payouts and create Plain thread on denial
        if review_context == ReviewContext.SETUP_COMPLETE:
            if report.verdict == ReviewVerdict.DENY:
                organization.status = OrganizationStatus.INITIAL_REVIEW
                organization.status_updated_at = datetime.now(UTC)
                session.add(organization)

                await organization_service._sync_account_status(session, organization)

                await review_repository.record_agent_decision(
                    organization_id=organization_id,
                    agent_review_id=agent_review.id,
                    decision="ESCALATE",
                    review_context="setup_complete",
                    verdict=report.verdict.value,
                    risk_score=report.overall_risk_score,
                )

                log.info(
                    "organization_review.setup_complete.flagged",
                    organization_id=str(organization_id),
                    slug=organization.slug,
                    verdict=report.verdict.value,
                )
