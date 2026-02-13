import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarTaskError
from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .agent import run_organization_review
from .repository import OrganizationReviewRepository

log = structlog.get_logger(__name__)


class OrganizationReviewTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationReviewTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="organization_review.run_agent",
    priority=TaskPriority.LOW,
    time_limit=180_000,  # 3 min timeout
    max_retries=1,
)
async def run_review_agent(organization_id: uuid.UUID) -> None:
    """Run the organization review agent as a background task (log-only)."""
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
        result = await run_organization_review(session, organization)

        report = result.report
        log.info(
            "organization_review.task.complete",
            organization_id=str(organization_id),
            slug=organization.slug,
            verdict=report.verdict.value,
            overall_risk_score=report.overall_risk_score,
            summary=report.summary,
            model_used=result.model_used,
            duration_seconds=result.duration_seconds,
            estimated_cost_usd=result.usage.estimated_cost_usd,
        )

        # Persist agent report to its own table
        review_repository = OrganizationReviewRepository.from_session(session)
        await review_repository.save_agent_review(
            organization_id=organization_id,
            report=result.model_dump(mode="json"),
            model_used=result.model_used,
            reviewed_at=datetime.now(UTC),
        )
