import uuid
from datetime import UTC, datetime

import structlog

from polar.config import Environment, settings
from polar.exceptions import PolarTaskError
from polar.integrations.polar.service import polar_self
from polar.models.organization import Organization, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.organization.repository import (
    OrganizationRepository,
)
from polar.organization.repository import (
    OrganizationReviewRepository as OrgReviewRepository,
)
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .agent import run_organization_review
from .report import build_agent_report
from .repository import OrganizationReviewRepository
from .schemas import (
    ActorType,
    AgentReviewResult,
    DecisionType,
    ReviewContext,
    ReviewVerdict,
)

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


async def _persist_agent_result(
    session: AsyncSession,
    organization: Organization,
    review_context: ReviewContext,
    result: AgentReviewResult,
) -> uuid.UUID:
    """Log + track usage + persist OrganizationAgentReview. Returns its id."""
    report = result.report
    log.info(
        "organization_review.task.complete",
        organization_id=str(organization.id),
        slug=organization.slug,
        context=review_context.value,
        verdict=report.verdict.value,
        overall_risk_score=report.overall_risk_score,
        summary=report.summary,
        model_used=result.model_used,
        duration_seconds=result.duration_seconds,
        estimated_cost_usd=result.usage.estimated_cost_usd,
    )

    polar_self.enqueue_track_organization_review_usage(
        external_customer_id=str(organization.id),
        review_context=review_context.value,
        vendor=result.model_provider,
        model=result.model_used,
        input_tokens=result.usage.input_tokens,
        output_tokens=result.usage.output_tokens,
        cost_usd=result.usage.estimated_cost_usd,
    )

    review_repository = OrganizationReviewRepository.from_session(session)
    typed_report = build_agent_report(result, review_type=review_context.value)
    agent_review = await review_repository.save_agent_review(
        organization_id=organization.id,
        report=typed_report,
        reviewed_at=datetime.now(UTC),
    )
    return agent_review.id


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
    plain_thread_id: str | None = None,  # kept for in-flight job compatibility
) -> None:
    """Run the organization review agent as a background task.

    For SUBMISSION context: creates an OrganizationReview record and auto-denies on DENY.
    For THRESHOLD context: log-only, persists to OrganizationAgentReview table.
    """
    if settings.ENV == Environment.sandbox:
        return

    review_context = ReviewContext(context)

    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id, include_blocked=True)
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
                return
            raise

        report = result.report
        agent_review_id = await _persist_agent_result(
            session, organization, review_context, result
        )
        review_repository = OrganizationReviewRepository.from_session(session)

        # For THRESHOLD context with auto-approve eligibility:
        # delegate decision to the service layer
        if review_context == ReviewContext.THRESHOLD and auto_approve_eligible:
            # If a human manually set this org under review, skip auto-action
            current_decision = await review_repository.get_current_decision(
                organization_id
            )
            if (
                current_decision is not None
                and current_decision.actor_type == ActorType.HUMAN
                and current_decision.review_context == ReviewContext.MANUAL
            ):
                auto_approve_eligible = False
                log.info(
                    "organization_review.threshold.manual_review_override",
                    organization_id=str(organization_id),
                    slug=organization.slug,
                    verdict=report.verdict.value,
                )

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
                    agent_review_id=agent_review_id,
                    decision=DecisionType.APPROVE,
                    review_context=ReviewContext.THRESHOLD,
                    verdict=report.verdict,
                    risk_score=report.overall_risk_score,
                )

        # For SUBMISSION context: also create OrganizationReview record and act
        if review_context == ReviewContext.SUBMISSION:
            mapped_verdict = _VERDICT_MAP[report.verdict]

            org_review_repository = OrgReviewRepository.from_session(session)
            existing = await org_review_repository.get_by_organization(organization_id)

            is_grandfathered = (
                existing is not None
                and existing.verdict == OrganizationReview.Verdict.PASS
                and existing.reason == "Grandfathered organization"
            )

            if is_grandfathered:
                assert existing is not None
                existing.verdict = OrganizationReview.Verdict(mapped_verdict)
                existing.risk_score = report.overall_risk_score
                existing.violated_sections = report.violated_sections
                existing.reason = report.merchant_summary
                existing.timed_out = result.timed_out
                existing.organization_details_snapshot = {
                    "name": organization.name,
                    "website": organization.website,
                    "details": organization.details,
                    "socials": organization.socials,
                }
                existing.model_used = result.model_used
                session.add(existing)
            elif existing is None:
                org_review = OrganizationReview(
                    organization_id=organization_id,
                    verdict=mapped_verdict,
                    risk_score=report.overall_risk_score,
                    violated_sections=report.violated_sections,
                    reason=report.merchant_summary,
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
                organization.set_status(OrganizationStatus.DENIED)
                session.add(organization)

                await review_repository.record_agent_decision(
                    organization_id=organization_id,
                    agent_review_id=agent_review_id,
                    decision=DecisionType.DENY,
                    review_context=ReviewContext.SUBMISSION,
                    verdict=report.verdict,
                    risk_score=report.overall_risk_score,
                )

                log.info(
                    "organization_review.submission.denied",
                    organization_id=str(organization_id),
                    slug=organization.slug,
                    verdict=report.verdict.value,
                )
            elif report.verdict == ReviewVerdict.APPROVE:
                await organization_service.maybe_activate(session, organization)


@actor(
    actor_name="organization_review.appeal_submitted",
    priority=TaskPriority.LOW,
    time_limit=180_000,
    max_retries=1,
)
async def review_appeal(organization_id: uuid.UUID) -> None:
    """Auto-review a submitted appeal with the AI agent.

    The merchant's appeal is decisive: APPROVE activates the org, DENY closes
    out the appeal with a "contact support" message and no Plain ticket.
    """
    if settings.ENV == Environment.sandbox:
        return

    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id, include_blocked=True)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        org_review_repository = OrgReviewRepository.from_session(session)
        review = await org_review_repository.get_by_organization(organization_id)
        if review is None or review.appeal_submitted_at is None:
            log.warning(
                "organization_review.appeal.no_pending_appeal",
                organization_id=str(organization_id),
                slug=organization.slug,
            )
            return

        if review.appeal_decision is not None:
            log.info(
                "organization_review.appeal.already_decided",
                organization_id=str(organization_id),
                slug=organization.slug,
                decision=review.appeal_decision,
            )
            return

        result = await run_organization_review(
            session,
            organization,
            context=ReviewContext.APPEAL,
            appeal_reason=review.appeal_reason,
            original_denial_reason=review.reason,
        )
        report = result.report
        agent_review_id = await _persist_agent_result(
            session, organization, ReviewContext.APPEAL, result
        )

        if report.verdict == ReviewVerdict.APPROVE:
            await organization_service.approve_appeal(session, organization)
            decision = DecisionType.APPROVE
        else:
            await organization_service.deny_appeal(session, organization)
            decision = DecisionType.DENY

        agent_review_repository = OrganizationReviewRepository.from_session(session)
        await agent_review_repository.record_agent_decision(
            organization_id=organization_id,
            agent_review_id=agent_review_id,
            decision=decision,
            review_context=ReviewContext.APPEAL,
            verdict=report.verdict,
            risk_score=report.overall_risk_score,
        )
