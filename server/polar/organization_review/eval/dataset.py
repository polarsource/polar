"""Extract eval datasets from organization_review_feedback + organization_agent_reviews.

Uses human-reviewed feedback as ground truth: the human decision (APPROVE/DENY)
is the label, and the full DataSnapshot from the linked agent review provides
the model input.  This replaces the old extraction from the organization_reviews
table, which only captured appeals.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog
from pydantic import Field
from pydantic_evals import Case, Dataset
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.schemas import Schema
from polar.models.organization_agent_review import OrganizationAgentReview
from polar.models.organization_review_feedback import OrganizationReviewFeedback
from polar.organization_review.report import parse_agent_report
from polar.organization_review.schemas import DataSnapshot

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Case schemas
# ---------------------------------------------------------------------------


class FeedbackReviewInput(Schema):
    """Input to the review task — a full DataSnapshot from the agent review."""

    data_snapshot: DataSnapshot
    review_type: str = "unknown"


class FeedbackReviewMetadata(Schema):
    """Extra context about the eval case (not fed to the model)."""

    organization_id: str
    organization_name: str
    feedback_id: str
    review_context: str
    agent_verdict: str | None = None
    human_decision: str
    human_reason: str | None = None
    is_override: bool = False
    model_used: str | None = None
    decided_at: datetime | None = None


# Verdict mapping: feedback decision -> eval expected output
_DECISION_TO_EXPECTED = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
}

# Type alias
FeedbackReviewDataset = Dataset[FeedbackReviewInput, str, FeedbackReviewMetadata]


# ---------------------------------------------------------------------------
# Case construction
# ---------------------------------------------------------------------------


def _feedback_to_case(
    feedback: OrganizationReviewFeedback,
    parsed_report: Any,
) -> Case[FeedbackReviewInput, str, FeedbackReviewMetadata]:
    """Convert a feedback + its parsed agent report into an eval case."""
    snapshot: DataSnapshot = parsed_report.data_snapshot
    org_name = snapshot.organization.name

    expected_output = _DECISION_TO_EXPECTED.get(
        feedback.decision or "", feedback.decision or "UNKNOWN"
    )
    is_override = (feedback.decision or "") != (feedback.verdict or "")

    case_name = org_name
    if is_override:
        case_name = f"{org_name} [override:{feedback.verdict}->{feedback.decision}]"

    return Case(
        name=case_name,
        inputs=FeedbackReviewInput(
            data_snapshot=snapshot,
            review_type=parsed_report.review_type or "unknown",
        ),
        expected_output=expected_output,
        metadata=FeedbackReviewMetadata(
            organization_id=str(feedback.organization_id),
            organization_name=org_name,
            feedback_id=str(feedback.id),
            review_context=feedback.review_context or "unknown",
            agent_verdict=feedback.verdict,
            human_decision=feedback.decision or "UNKNOWN",
            human_reason=feedback.reason,
            is_override=is_override,
            model_used=parsed_report.model_used,
            decided_at=feedback.created_at,
        ),
    )


# ---------------------------------------------------------------------------
# Dataset extraction
# ---------------------------------------------------------------------------


async def extract_dataset(
    session: Any,
    *,
    context_filter: list[str] | None = None,
    only_overrides: bool = False,
    exclude_escalations: bool = True,
    limit: int | None = None,
) -> FeedbackReviewDataset:
    """Extract eval cases from organization_review_feedback.

    Args:
        session: SQLAlchemy async session.
        context_filter: Only include these review contexts
            (e.g. ["submission", "threshold"]).
        only_overrides: If True, only include cases where the human
            disagreed with the agent verdict.
        exclude_escalations: Skip ESCALATE decisions (default True) since
            they don't have a clear PASS/FAIL ground truth.
        limit: Max number of cases to extract.
    """
    stmt = (
        select(OrganizationReviewFeedback)
        .where(
            OrganizationReviewFeedback.deleted_at.is_(None),
            OrganizationReviewFeedback.actor_type == "human",
            OrganizationReviewFeedback.agent_review_id.is_not(None),
            OrganizationReviewFeedback.decision.is_not(None),
        )
        .options(selectinload(OrganizationReviewFeedback.agent_review))
        .order_by(OrganizationReviewFeedback.created_at.desc())
    )

    if exclude_escalations:
        stmt = stmt.where(OrganizationReviewFeedback.decision != "ESCALATE")

    if context_filter:
        stmt = stmt.where(
            OrganizationReviewFeedback.review_context.in_(context_filter)
        )

    if only_overrides:
        stmt = stmt.where(
            OrganizationReviewFeedback.decision
            != OrganizationReviewFeedback.verdict
        )

    if limit:
        stmt = stmt.limit(limit)

    result = await session.execute(stmt)
    feedbacks: list[OrganizationReviewFeedback] = list(result.scalars().all())

    cases: list[Case[FeedbackReviewInput, str, FeedbackReviewMetadata]] = []
    skipped = 0

    for fb in feedbacks:
        agent_review: OrganizationAgentReview | None = fb.agent_review
        if agent_review is None or agent_review.report is None:
            skipped += 1
            continue

        try:
            parsed = parse_agent_report(agent_review.report)
        except Exception:
            log.warning(
                "dataset.parse_failed",
                feedback_id=str(fb.id),
                agent_review_id=str(agent_review.id),
            )
            skipped += 1
            continue

        cases.append(_feedback_to_case(fb, parsed))

    # Deduplicate names (pydantic-evals requires unique case names)
    seen: dict[str, int] = {}
    for case in cases:
        name = case.name or "unknown"
        if name in seen:
            seen[name] += 1
            org_id = (
                str(case.metadata.organization_id)[:8] if case.metadata else ""
            )
            case.name = f"{name} ({org_id})"
        else:
            seen[name] = 1

    log.info(
        "dataset.extracted",
        total=len(cases),
        skipped=skipped,
        overrides=sum(1 for c in cases if c.metadata and c.metadata.is_override),
    )
    return Dataset(cases=cases)
