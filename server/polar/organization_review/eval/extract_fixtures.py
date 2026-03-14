"""Extract eval fixtures from the database for offline testing.

Run: cd server && uv run python -m polar.organization_review.eval.extract_fixtures [--limit 30]

Saves cases to eval/fixtures/sample_cases.json.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import structlog
from sqlalchemy import select
from sqlalchemy.orm import selectinload

log = structlog.get_logger(__name__)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


async def extract(limit: int = 30) -> None:
    from polar.kit.db.postgres import AsyncReadSessionMaker
    from polar.models.organization_agent_review import OrganizationAgentReview
    from polar.models.organization_review_feedback import OrganizationReviewFeedback

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    async with AsyncReadSessionMaker() as session:
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
            .limit(limit)
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

    overrides = sum(1 for c in cases if c["human_decision"] != c["agent_verdict"])
    print(f"Extracted {len(cases)} cases ({overrides} overrides) to {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.0f} KB")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Extract eval fixtures from DB")
    parser.add_argument(
        "--limit", type=int, default=30,
        help="Max cases to extract (default: 30)",
    )
    args = parser.parse_args()
    asyncio.run(extract(limit=args.limit))


if __name__ == "__main__":
    main()
