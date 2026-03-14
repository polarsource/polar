"""Extract sample eval fixtures from the database for offline testing.

Run: cd server && uv run python -m polar.organization_review.eval.extract_fixtures

Saves cases to eval/fixtures/sample_cases.json.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import structlog

log = structlog.get_logger(__name__)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


async def extract() -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from polar.kit.db.postgres import AsyncReadSessionMaker
    from polar.models.organization_agent_review import OrganizationAgentReview
    from polar.models.organization_review_feedback import OrganizationReviewFeedback

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    async with AsyncReadSessionMaker() as session:
        # Get a diverse sample: overrides + agreements + false negatives
        stmt = (
            select(OrganizationReviewFeedback)
            .where(
                OrganizationReviewFeedback.deleted_at.is_(None),
                OrganizationReviewFeedback.actor_type == "human",
                OrganizationReviewFeedback.agent_review_id.is_not(None),
                OrganizationReviewFeedback.decision.in_(["APPROVE", "DENY"]),
            )
            .options(selectinload(OrganizationReviewFeedback.agent_review))
            .order_by(OrganizationReviewFeedback.created_at.desc())
            .limit(20)
        )

        result = await session.execute(stmt)
        feedbacks = list(result.scalars().all())

    cases = []
    for fb in feedbacks:
        ar: OrganizationAgentReview = fb.agent_review
        if ar is None or ar.report is None:
            continue

        report = ar.report
        snapshot = report.get("data_snapshot")
        if snapshot is None:
            continue

        cases.append(
            {
                "org_name": snapshot.get("organization", {}).get("name", "unknown"),
                "review_type": report.get("review_type", "unknown"),
                "human_decision": fb.decision,
                "agent_verdict": fb.verdict,
                "human_reason": fb.reason,
                "review_context": fb.review_context,
                "data_snapshot": snapshot,
            }
        )

    output_path = FIXTURES_DIR / "sample_cases.json"
    with open(output_path, "w") as f:
        json.dump(cases, f, indent=2, default=str)

    log.info(
        "fixtures.extracted",
        count=len(cases),
        path=str(output_path),
    )
    print(f"Extracted {len(cases)} cases to {output_path}")


if __name__ == "__main__":
    asyncio.run(extract())
