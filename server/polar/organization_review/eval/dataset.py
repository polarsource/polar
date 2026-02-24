"""Extract eval datasets from organization_reviews table."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog
from pydantic import Field
from pydantic_evals import Case, Dataset
from sqlalchemy import select

from polar.kit.schemas import Schema
from polar.models.organization_review import OrganizationReview

log = structlog.get_logger(__name__)


class ReviewInput(Schema):
    """Input to the review task — the organization snapshot stored at review time."""

    name: str
    website: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    socials: list[dict[str, str]] = Field(default_factory=list)


class ReviewMetadata(Schema):
    """Extra context about the eval case (not fed to the model)."""

    organization_id: str
    risk_score: float
    reason: str
    model_used: str
    validated_at: datetime
    appeal_decision: str | None = None


# Type alias for our eval dataset
ReviewDataset = Dataset[ReviewInput, str, ReviewMetadata]


def _review_to_case(review: OrganizationReview) -> Case[ReviewInput, str, ReviewMetadata]:
    snapshot = review.organization_details_snapshot
    name = snapshot.get("name", str(review.organization_id))

    # If appeal was approved, the human override is the real ground truth
    if review.appeal_decision == "approved":
        expected_output = "PASS"
        name = f"{name} [appeal-approved]"
    else:
        expected_output = review.verdict

    return Case(
        name=name,
        inputs=ReviewInput(
            name=snapshot.get("name", "unknown"),
            website=snapshot.get("website"),
            details=snapshot.get("details", {}),
            socials=snapshot.get("socials", []),
        ),
        expected_output=expected_output,
        metadata=ReviewMetadata(
            organization_id=str(review.organization_id),
            risk_score=review.risk_score,
            reason=review.reason,
            model_used=review.model_used,
            validated_at=review.validated_at,
            appeal_decision=review.appeal_decision,
        ),
    )


async def extract_dataset(
    session: Any,
    *,
    verdict_filter: list[str] | None = None,
    exclude_grandfathered: bool = True,
    exclude_timed_out: bool = True,
    limit: int | None = None,
) -> ReviewDataset:
    """Extract eval cases from organization_reviews.

    Args:
        session: SQLAlchemy async session
        verdict_filter: Only include these verdicts (e.g. ["PASS", "FAIL"])
        exclude_grandfathered: Skip reviews with model_used="grandfathered"
        exclude_timed_out: Skip reviews that timed out
        limit: Max number of cases to extract
    """
    stmt = select(OrganizationReview).where(
        OrganizationReview.deleted_at.is_(None),
    )

    if exclude_grandfathered:
        stmt = stmt.where(OrganizationReview.model_used != "grandfathered")

    if exclude_timed_out:
        stmt = stmt.where(OrganizationReview.timed_out.is_(False))

    if verdict_filter:
        stmt = stmt.where(OrganizationReview.verdict.in_(verdict_filter))

    stmt = stmt.order_by(OrganizationReview.validated_at.desc())

    if limit:
        stmt = stmt.limit(limit)

    result = await session.execute(stmt)
    reviews = result.scalars().all()

    cases = [_review_to_case(review) for review in reviews]

    # Deduplicate names (pydantic-evals requires unique case names)
    seen: dict[str, int] = {}
    for case in cases:
        name = case.name or "unknown"
        if name in seen:
            seen[name] += 1
            org_id = str(case.metadata.organization_id)[:8] if case.metadata else ""
            case.name = f"{name} ({org_id})"
        else:
            seen[name] = 1

    log.info("dataset.extracted", total=len(cases))
    return Dataset(cases=cases)
