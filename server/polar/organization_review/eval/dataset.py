"""Extract eval datasets from organization review feedback.

Pulls cases from organization_review_feedback joined with
organization_agent_reviews to get the full DataSnapshot that was
used during the original review.

The dataset is composed of three categories:
- False approvals (agent APPROVE, human DENY) — the dangerous case,
  where the AI let a bad org through.  Targeted at 50% of the dataset.
- Matches (agent and human agree) — baseline sanity checks.
- False denials (agent DENY, human APPROVE) — overly cautious, safe
  since denied orgs always get human review.
"""

from __future__ import annotations

from typing import Any

import structlog
from pydantic_evals import Case, Dataset
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.schemas import Schema
from polar.models.organization_agent_review import OrganizationAgentReview
from polar.models.organization_review_feedback import OrganizationReviewFeedback
from polar.organization_review.report import parse_agent_report
from polar.organization_review.schemas import (
    ActorType,
    DataSnapshot,
    DecisionType,
    ReviewVerdict,
)

log = structlog.get_logger(__name__)

# Human decision -> eval expected output
_DECISION_TO_EXPECTED = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
}

DEFAULT_DATASET_PATH = "cases.json"
DEFAULT_TOTAL = 200


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class EvalInput(Schema):
    """Input to the review eval task."""

    data_snapshot: DataSnapshot
    review_type: str = "threshold"


class EvalMetadata(Schema):
    """Metadata about the eval case (not fed to the model)."""

    organization_id: str
    organization_name: str
    agent_verdict: str | None = None
    human_decision: str
    human_reason: str | None = None
    review_context: str | None = None


# Type alias for our eval dataset
EvalDataset = Dataset[EvalInput, str, EvalMetadata]


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def _feedback_to_case(
    fb: OrganizationReviewFeedback,
    parsed: Any,
) -> Case[EvalInput, str, EvalMetadata] | None:
    """Convert a feedback row + parsed agent report into an eval case."""
    org_name = parsed.data_snapshot.organization.name
    expected = _DECISION_TO_EXPECTED.get(fb.decision or "")
    if expected is None:
        return None

    return Case(
        name=org_name,
        inputs=EvalInput(
            data_snapshot=parsed.data_snapshot,
            review_type=parsed.review_type,
        ),
        expected_output=expected,
        metadata=EvalMetadata(
            organization_id=str(fb.organization_id),
            organization_name=org_name,
            agent_verdict=fb.verdict,
            human_decision=fb.decision or "UNKNOWN",
            human_reason=fb.reason,
            review_context=fb.review_context,
        ),
    )


async def extract_dataset(
    session: Any,
    *,
    total: int = DEFAULT_TOTAL,
) -> EvalDataset:
    """Extract a balanced eval dataset, ordered newest first.

    Composition:
    - 50% false approvals (agent APPROVE, human DENY) — dangerous
    - 25% matches (agent and human agree)
    - 25% false denials (agent DENY, human APPROVE)

    If fewer false approvals exist than the 50% target, all of them
    are included and the rest is filled from matches and false denials.

    Args:
        session: SQLAlchemy async session.
        total: Target number of cases to extract.
    """
    stmt = (
        select(OrganizationReviewFeedback)
        .where(
            OrganizationReviewFeedback.deleted_at.is_(None),
            OrganizationReviewFeedback.actor_type == ActorType.HUMAN,
            OrganizationReviewFeedback.agent_review_id.is_not(None),
            OrganizationReviewFeedback.decision.in_(
                [DecisionType.APPROVE, DecisionType.DENY]
            ),
        )
        .options(selectinload(OrganizationReviewFeedback.agent_review))
        .order_by(OrganizationReviewFeedback.created_at.desc())
    )

    result = await session.execute(stmt)
    feedbacks = list(result.scalars().all())

    # Parse and categorize
    false_approvals: list[Case[EvalInput, str, EvalMetadata]] = []
    false_denials: list[Case[EvalInput, str, EvalMetadata]] = []
    matches: list[Case[EvalInput, str, EvalMetadata]] = []
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

        case = _feedback_to_case(fb, parsed)
        if case is None:
            skipped += 1
            continue

        if fb.verdict == ReviewVerdict.APPROVE and fb.decision == DecisionType.DENY:
            false_approvals.append(case)
        elif fb.verdict == ReviewVerdict.DENY and fb.decision == DecisionType.APPROVE:
            false_denials.append(case)
        else:
            matches.append(case)

    # Compose balanced dataset
    n_fa = min(len(false_approvals), total // 2)
    n_rest = total - n_fa
    n_match = min(len(matches), n_rest // 2)
    n_fd = min(len(false_denials), n_rest - n_match)

    cases = false_approvals[:n_fa] + matches[:n_match] + false_denials[:n_fd]

    # Fill shortfall from whatever's available
    if len(cases) < total:
        remaining = false_approvals[n_fa:] + matches[n_match:] + false_denials[n_fd:]
        cases.extend(remaining[: total - len(cases)])

    # Deduplicate names (pydantic-evals requires unique case names)
    seen: dict[str, int] = {}
    for case in cases:
        name = case.name or "unknown"
        seen[name] = seen.get(name, 0) + 1
        if seen[name] > 1:
            case.name = f"{name} #{seen[name]}"

    log.info(
        "dataset.extracted",
        total=len(cases),
        false_approvals=n_fa,
        matches=n_match,
        false_denials=n_fd,
        skipped=skipped,
    )
    return Dataset(cases=cases)
