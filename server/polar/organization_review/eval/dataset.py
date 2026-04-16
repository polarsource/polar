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


CaseType = Case[EvalInput, str, EvalMetadata]


async def _fetch_all_cases(session: Any) -> tuple[list[CaseType], int]:
    """Fetch and parse all human-reviewed cases, newest first."""
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

    cases: list[CaseType] = []
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

        cases.append(case)

    return cases, skipped


def _balance_and_dedup(
    buckets: list[tuple[str, list[CaseType], int]],
    total: int,
    skipped: int,
    log_event: str,
) -> EvalDataset:
    """Balance buckets by target counts, fill shortfall, and deduplicate names."""
    selected: list[CaseType] = []
    remaining: list[CaseType] = []
    log_kwargs: dict[str, int] = {"total": 0, "skipped": skipped}

    for name, cases, target in buckets:
        n = min(len(cases), target)
        selected.extend(cases[:n])
        remaining.extend(cases[n:])
        log_kwargs[name] = n

    if len(selected) < total:
        selected.extend(remaining[: total - len(selected)])

    # Deduplicate names (pydantic-evals requires unique case names)
    seen: dict[str, int] = {}
    for case in selected:
        case_name = case.name or "unknown"
        seen[case_name] = seen.get(case_name, 0) + 1
        if seen[case_name] > 1:
            case.name = f"{case_name} #{seen[case_name]}"

    log_kwargs["total"] = len(selected)
    log.info(f"dataset.{log_event}", **log_kwargs)
    return Dataset(cases=selected)


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
    """
    all_cases, skipped = await _fetch_all_cases(session)

    false_approvals: list[CaseType] = []
    false_denials: list[CaseType] = []
    matches: list[CaseType] = []

    for case in all_cases:
        meta = case.metadata
        if meta and meta.agent_verdict == "DENY" and meta.human_decision == "APPROVE":
            false_denials.append(case)
        elif meta and meta.agent_verdict == "APPROVE" and meta.human_decision == "DENY":
            false_approvals.append(case)
        else:
            matches.append(case)

    n_fa = min(len(false_approvals), total // 2)
    n_rest = total - n_fa

    return _balance_and_dedup(
        [
            ("false_approvals", false_approvals, n_fa),
            ("matches", matches, n_rest // 2),
            ("false_denials", false_denials, n_rest - n_rest // 2),
        ],
        total,
        skipped,
        "extracted",
    )


async def extract_voting_dataset(
    session: Any,
    *,
    total: int = DEFAULT_TOTAL,
) -> EvalDataset:
    """Extract an eval dataset optimized for voting evaluation.

    Composition:
    - 50% false denials (agent DENY, human APPROVE) — voting should catch these
    - 30% true denials (agent DENY, human DENY) — voting must NOT flip these
    - 20% true approvals (agent APPROVE, human APPROVE) — sanity check
    """
    all_cases, skipped = await _fetch_all_cases(session)

    false_denials: list[CaseType] = []
    true_denials: list[CaseType] = []
    true_approvals: list[CaseType] = []

    for case in all_cases:
        meta = case.metadata
        if meta and meta.agent_verdict == "DENY" and meta.human_decision == "APPROVE":
            false_denials.append(case)
        elif meta and meta.agent_verdict == "DENY" and meta.human_decision == "DENY":
            true_denials.append(case)
        elif (
            meta
            and meta.agent_verdict == "APPROVE"
            and meta.human_decision == "APPROVE"
        ):
            true_approvals.append(case)

    return _balance_and_dedup(
        [
            ("false_denials", false_denials, total // 2),
            ("true_denials", true_denials, (total * 3) // 10),
            ("true_approvals", true_approvals, total - total // 2 - (total * 3) // 10),
        ],
        total,
        skipped,
        "voting_extracted",
    )
