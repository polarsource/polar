"""Run organization review evals.

Usage:
    uv run python -m evals.organization_review
    uv run python -m evals.organization_review --help
"""

import argparse
import sys

from polar.organization_review.analyzer import ReviewAnalyzer
from polar.organization_review.policy import FALLBACK_POLICY
from polar.organization_review.schemas import (
    DataSnapshot,
    ReviewAgentReport,
)

from .dataset import build_dataset


async def _run_review(snapshot: DataSnapshot) -> ReviewAgentReport:
    """Task function: run the review analyzer on a snapshot."""
    analyzer = ReviewAnalyzer()
    report, _usage = await analyzer.analyze(snapshot, context=snapshot.context)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Run organization review evals")
    parser.add_argument(
        "--case",
        type=str,
        default=None,
        help="Run only the named case (e.g. 'legitimate_saas_submission')",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Include inputs/outputs in the report",
    )
    args = parser.parse_args()

    # Pre-seed the policy cache so evals don't hit the network for it
    import polar.organization_review.policy as policy_mod

    policy_mod._cached_policy_content = FALLBACK_POLICY

    dataset = build_dataset()

    # Optionally filter to a single case
    if args.case:
        matching = [c for c in dataset.cases if c.name == args.case]
        if not matching:
            available = ", ".join(c.name for c in dataset.cases)
            print(f"Unknown case '{args.case}'. Available: {available}")
            sys.exit(1)
        dataset.cases = matching

    print(f"Running {len(dataset.cases)} eval case(s)...\n")

    report = dataset.evaluate_sync(_run_review)
    report.print(
        include_input=args.verbose,
        include_output=args.verbose,
    )


if __name__ == "__main__":
    main()
