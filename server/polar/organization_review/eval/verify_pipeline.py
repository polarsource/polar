"""Minimal pipeline verification: deserialize DataSnapshot -> run analyzer -> check verdict.

Run: cd server && uv run python -m polar.organization_review.eval.verify_pipeline
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

FIXTURES_PATH = Path(__file__).parent / "fixtures" / "sample_cases.json"

# Map from feedback decision -> eval expected output
_DECISION_MAP = {"APPROVE": "PASS", "DENY": "FAIL"}
_VERDICT_MAP = {"APPROVE": "PASS", "DENY": "FAIL", "NEEDS_HUMAN_REVIEW": "FAIL"}


async def verify() -> None:
    from polar.organization_review.analyzer import ReviewAnalyzer
    from polar.organization_review.schemas import DataSnapshot, ReviewContext

    CONTEXT_MAP = {
        "submission": ReviewContext.SUBMISSION,
        "setup_complete": ReviewContext.SETUP_COMPLETE,
        "threshold": ReviewContext.THRESHOLD,
        "manual": ReviewContext.MANUAL,
    }

    if not FIXTURES_PATH.exists():
        print(f"ERROR: No fixtures at {FIXTURES_PATH}")
        print("Run: uv run python -m polar.organization_review.eval.extract_fixtures")
        sys.exit(1)

    with open(FIXTURES_PATH) as f:
        cases = json.load(f)

    if not cases:
        print("ERROR: Fixtures file is empty")
        sys.exit(1)

    analyzer = ReviewAnalyzer()

    print(f"\nRunning {len(cases)} eval cases through the analyzer...\n")
    print(
        f"{'Org':<25} {'Expected':<10} {'Predicted':<10} {'Match':<8} {'Time':<8}"
    )
    print("-" * 61)

    correct = 0
    total_cost = 0.0

    for raw in cases:
        snapshot = DataSnapshot.model_validate(raw["data_snapshot"])
        context = CONTEXT_MAP.get(raw["review_type"], ReviewContext.THRESHOLD)
        expected = _DECISION_MAP.get(raw["human_decision"], "UNKNOWN")
        org_name = raw["org_name"]

        start = time.monotonic()
        report, usage = await analyzer.analyze(snapshot, context=context)
        elapsed = time.monotonic() - start

        predicted = _VERDICT_MAP.get(report.verdict.value, report.verdict.value)
        match = predicted == expected

        if match:
            correct += 1

        cost = usage.estimated_cost_usd or 0
        total_cost += cost

        print(
            f"{org_name:<25} "
            f"{expected:<10} "
            f"{predicted:<10} "
            f"{'OK' if match else 'MISS':<8} "
            f"{elapsed:.1f}s"
        )

        if not match:
            print(f"  Agent verdict: {report.verdict.value}")
            print(f"  Risk level: {report.overall_risk_level}")
            print(f"  Summary: {report.summary[:120]}...")
            if raw.get("human_reason"):
                print(f"  Human reason: {raw['human_reason']}")

    print()
    print(f"Results: {correct}/{len(cases)} correct")
    print(f"Accuracy: {correct / len(cases):.0%}")
    print(f"Total cost: ${total_cost:.4f}")


if __name__ == "__main__":
    asyncio.run(verify())
