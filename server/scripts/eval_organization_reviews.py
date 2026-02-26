"""
Eval system for organization reviews using pydantic-evals.

Uses organization_reviews as ground truth to test new models/prompts
against historical review decisions.

Usage:
    cd server

    # Export dataset from DB to JSON (default: non-grandfathered, non-timed-out)
    uv run python -m scripts.eval_organization_reviews export --output eval_dataset.json

    # Export only FAIL + UNCERTAIN verdicts
    uv run python -m scripts.eval_organization_reviews export --verdicts FAIL UNCERTAIN --output eval_dataset.json

    # Export with limit
    uv run python -m scripts.eval_organization_reviews export --limit 50 --output eval_dataset.json

    # Run eval against exported dataset with current model
    uv run python -m scripts.eval_organization_reviews run --dataset eval_dataset.json

    # Run eval with a different model
    uv run python -m scripts.eval_organization_reviews run --dataset eval_dataset.json --model gpt-4o

    # Run eval with lower concurrency
    uv run python -m scripts.eval_organization_reviews run --dataset eval_dataset.json --concurrency 3

    # Run eval and save report to JSON
    uv run python -m scripts.eval_organization_reviews run --dataset eval_dataset.json --output eval_report.json
"""

import argparse
import asyncio
import sys
from collections import Counter
from pathlib import Path

import structlog

log = structlog.get_logger()


async def cmd_export(args: argparse.Namespace) -> None:
    """Export eval dataset from organization_reviews."""
    from polar.kit.db.postgres import create_async_sessionmaker
    from polar.organization_review.eval.dataset import extract_dataset
    from polar.postgres import create_async_engine

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            dataset = await extract_dataset(
                session,
                verdict_filter=args.verdicts,
                exclude_grandfathered=not args.include_grandfathered,
                exclude_timed_out=not args.include_timed_out,
                limit=args.limit,
            )

        output = Path(args.output)
        dataset.to_file(output)

        print(f"\nExported {len(dataset.cases)} eval cases to {output}")

        # Print breakdown
        verdicts = Counter(c.expected_output for c in dataset.cases)
        models = Counter(c.metadata.model_used for c in dataset.cases if c.metadata)
        appeals = sum(
            1 for c in dataset.cases if c.metadata and c.metadata.appeal_decision
        )

        print("\nVerdict distribution:")
        for v, count in verdicts.most_common():
            print(f"  {v}: {count}")

        print("\nModel distribution:")
        for m, count in models.most_common():
            print(f"  {m}: {count}")

        if appeals:
            appeal_decisions = Counter(
                c.metadata.appeal_decision
                for c in dataset.cases
                if c.metadata and c.metadata.appeal_decision
            )
            print(f"\nAppeals: {appeals}")
            for d, count in appeal_decisions.most_common():
                print(f"  {d}: {count}")

    finally:
        await engine.dispose()


async def cmd_run(args: argparse.Namespace) -> None:
    """Run eval against a dataset."""
    from polar.organization_review.eval.dataset import ReviewDataset
    from polar.organization_review.eval.evaluators import (
        NotFalseNegative,
        NotFalsePositive,
        VerdictMatch,
    )
    from polar.organization_review.eval.task import create_review_task

    dataset: ReviewDataset = ReviewDataset.from_file(Path(args.dataset))
    print(f"Loaded dataset with {len(dataset.cases)} cases")

    # Add evaluators
    dataset.evaluators = [
        VerdictMatch(),
        NotFalseNegative(),
        NotFalsePositive(),
    ]

    # Create the task function
    task = create_review_task(model=args.model)

    # Run evaluation
    report = await dataset.evaluate(
        task,
        max_concurrency=args.concurrency,
    )

    # Print results
    report.print(
        include_input=False,
        include_output=True,
        include_expected_output=True,
    )

    if args.output:
        output = Path(args.output)
        import dataclasses
        import json

        report_data = dataclasses.asdict(report)
        output.write_text(json.dumps(report_data, indent=2, default=str))
        print(f"\nReport saved to {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval system for organization reviews")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- export ---
    export_parser = subparsers.add_parser(
        "export", help="Export eval dataset from organization_reviews"
    )
    export_parser.add_argument(
        "--output", "-o", required=True, help="Output JSON file path"
    )
    export_parser.add_argument(
        "--verdicts",
        nargs="+",
        choices=["PASS", "FAIL", "UNCERTAIN"],
        help="Only include these verdicts",
    )
    export_parser.add_argument(
        "--include-grandfathered",
        action="store_true",
        help="Include grandfathered reviews (excluded by default)",
    )
    export_parser.add_argument(
        "--include-timed-out",
        action="store_true",
        help="Include timed-out reviews (excluded by default)",
    )
    export_parser.add_argument(
        "--limit", type=int, help="Max number of cases to export"
    )

    # --- run ---
    run_parser = subparsers.add_parser("run", help="Run eval against a dataset")
    run_parser.add_argument(
        "--dataset", "-d", required=True, help="Path to dataset JSON/YAML"
    )
    run_parser.add_argument(
        "--model", "-m", help="Model to use (default: settings.OPENAI_MODEL)"
    )
    run_parser.add_argument(
        "--concurrency",
        "-c",
        type=int,
        default=5,
        help="Max parallel API calls (default: 5)",
    )
    run_parser.add_argument("--output", "-o", help="Save report to JSON file")

    args = parser.parse_args()

    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )

    commands = {
        "export": cmd_export,
        "run": cmd_run,
    }

    try:
        asyncio.run(commands[args.command](args))
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log.error("Script failed", error=str(e), exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
