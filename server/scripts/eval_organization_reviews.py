"""Eval system for organization reviews.

Extracts a balanced dataset of review cases, runs the analyzer
against them, and optionally optimizes the system prompt with GEPA.

Usage:
    cd server

    # Extract balanced dataset from production DB
    uv run python -m scripts.eval_organization_reviews extract --db-uri "postgresql+asyncpg://..."

    # Extract with custom size
    uv run python -m scripts.eval_organization_reviews extract --db-uri "..." --total 100

    # Run eval against dataset
    uv run python -m scripts.eval_organization_reviews run

    # Run eval with a different model
    uv run python -m scripts.eval_organization_reviews run --dataset eval_dataset.json --model openai:gpt-4o

    # Optimize the system prompt with GEPA
    uv run python -m scripts.eval_organization_reviews optimize --max-evals 50
"""

import asyncio
import dataclasses
import json
import sys
from collections import Counter
from functools import wraps
from pathlib import Path
from typing import Any

import structlog
import typer
from sqlalchemy.ext.asyncio import create_async_engine

from polar.kit.db.postgres import create_async_sessionmaker
from polar.organization_review.eval.dataset import (
    DEFAULT_DATASET_PATH,
    DEFAULT_TOTAL,
    EvalDataset,
    extract_dataset,
    extract_voting_dataset,
)
from polar.organization_review.eval.evaluators import (
    VerdictMatch,
)
from polar.organization_review.eval.optimize import run_optimization
from polar.organization_review.eval.task import create_review_task

log = structlog.get_logger(__name__)

cli = typer.Typer(help="Organization review evaluation tools")


def typer_async(f: Any) -> Any:
    @wraps(f)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def extract(
    db_uri: str = typer.Option(
        ...,
        "--db-uri",
        help="PostgreSQL connection string (postgresql+asyncpg://...)",
    ),
    output: Path = typer.Option(
        DEFAULT_DATASET_PATH, "--output", "-o", help="Output JSON file"
    ),
    total: int = typer.Option(DEFAULT_TOTAL, help="Target number of cases"),
) -> None:
    """Extract a balanced eval dataset from the database.

    Composition (newest reviews first):
      50% false approvals (agent APPROVE, human DENY) — dangerous
      25% matches (agent and human agree)
      25% false denials (agent DENY, human APPROVE)
    """
    engine = create_async_engine(db_uri, pool_size=1, max_overflow=0)
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            dataset = await extract_dataset(session, total=total)

        dataset.to_file(output)

        typer.echo(f"\nExtracted {len(dataset.cases)} cases to {output}")

        if dataset.cases:
            # Show breakdown by case type
            fa = sum(
                1
                for c in dataset.cases
                if c.metadata
                and c.metadata.agent_verdict == "APPROVE"
                and c.metadata.human_decision == "DENY"
            )
            fd = sum(
                1
                for c in dataset.cases
                if c.metadata
                and c.metadata.agent_verdict == "DENY"
                and c.metadata.human_decision == "APPROVE"
            )
            match = len(dataset.cases) - fa - fd

            typer.echo(f"\n  False approvals (dangerous):  {fa}")
            typer.echo(f"  Matches:                      {match}")
            typer.echo(f"  False denials:                {fd}")

            contexts = Counter(
                c.metadata.review_context for c in dataset.cases if c.metadata
            )
            typer.echo("\nReview context distribution:")
            for ctx, count in contexts.most_common():
                typer.echo(f"  {ctx}: {count}")
    finally:
        await engine.dispose()


@cli.command(name="extract-voting")
@typer_async
async def extract_voting(
    db_uri: str = typer.Option(..., "--db-uri", help="PostgreSQL connection string"),
    output: Path = typer.Option(
        "voting_cases.json", "--output", "-o", help="Output JSON file"
    ),
    total: int = typer.Option(DEFAULT_TOTAL, help="Target number of cases"),
) -> None:
    """Extract eval dataset optimized for voting evaluation.

    Composition: 50% false denials, 30% true denials, 20% true approvals.
    """
    engine = create_async_engine(db_uri, pool_size=1, max_overflow=0)
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            dataset = await extract_voting_dataset(session, total=total)

        dataset.to_file(output)
        typer.echo(f"\nExtracted {len(dataset.cases)} cases to {output}")

        if dataset.cases:
            fd = sum(
                1
                for c in dataset.cases
                if c.metadata
                and c.metadata.agent_verdict == "DENY"
                and c.metadata.human_decision == "APPROVE"
            )
            td = sum(
                1
                for c in dataset.cases
                if c.metadata
                and c.metadata.agent_verdict == "DENY"
                and c.metadata.human_decision == "DENY"
            )
            ta = len(dataset.cases) - fd - td
            typer.echo(f"\n  False denials (voting target): {fd}")
            typer.echo(f"  True denials (must not flip):  {td}")
            typer.echo(f"  True approvals (sanity check): {ta}")

            contexts = Counter(
                c.metadata.review_context for c in dataset.cases if c.metadata
            )
            typer.echo("\nReview context distribution:")
            for ctx, count in contexts.most_common():
                typer.echo(f"  {ctx}: {count}")
    finally:
        await engine.dispose()


@cli.command()
@typer_async
async def run(
    dataset_path: Path = typer.Option(
        DEFAULT_DATASET_PATH, "--dataset", "-d", help="Path to dataset JSON"
    ),
    model: str | None = typer.Option(
        None,
        "--model",
        "-m",
        help="Model override (default: settings.OPENAI_MODEL)",
    ),
    policy: str | None = typer.Option(
        None,
        "--policy",
        "-p",
        help="Policy source: 'default' (read from disk), or path to a .txt file",
    ),
    concurrency: int = typer.Option(
        5, "--concurrency", "-c", help="Max parallel API calls"
    ),
    output: Path | None = typer.Option(
        None, "--output", "-o", help="Save report to JSON file"
    ),
) -> None:
    """Run eval against an extracted dataset.

    Re-runs the analyzer on each case and checks whether the
    verdict matches the expected output.
    """
    from polar.organization_review.policy import fetch_policy_content

    policy_override: str | None = None
    if policy == "default":
        policy_override = fetch_policy_content()
        typer.echo("Using DEFAULT (disk) policy")
    elif policy is not None:
        policy_override = Path(policy).read_text()
        typer.echo(f"Using policy from file: {policy}")

    dataset: EvalDataset = EvalDataset.from_file(dataset_path)
    typer.echo(f"Loaded {len(dataset.cases)} cases from {dataset_path}")

    dataset.evaluators = [VerdictMatch()]
    task = create_review_task(model=model, policy_override=policy_override)

    report = await dataset.evaluate(task, max_concurrency=concurrency)

    report.print(
        include_input=False,
        include_output=True,
        include_expected_output=True,
    )

    # Confusion matrix: AI verdict vs Human decision
    # tp = both approve, tn = both deny, fp = AI approve + human deny, fn = AI deny + human approve
    tp, tn, fp, fn = 0, 0, 0, 0
    fp_orgs: list[str] = []

    for case in report.cases:
        ai_approved = case.output == "PASS"
        human_approved = case.expected_output == "PASS"

        if ai_approved and human_approved:
            tp += 1
        elif not ai_approved and not human_approved:
            tn += 1
        elif ai_approved and not human_approved:
            fp += 1
            fp_orgs.append(case.name)
        else:
            fn += 1

    total = tp + tn + fp + fn
    typer.echo("\nConfusion Matrix (AI vs Human):")
    typer.echo(f"{'':>20} {'Human APPROVE':>15} {'Human DENY':>15}")
    typer.echo(f"  {'AI APPROVE':<18} {tp:>10}      {fp:>10}  {'!!' if fp else ''}")
    typer.echo(f"  {'AI DENY':<18} {fn:>10}      {tn:>10}")
    typer.echo("")
    typer.echo(f"  Accuracy:           {(tp + tn) / total:.0%}  ({tp + tn}/{total})")
    typer.echo(f"  False approvals:    {fp}  (AI approved, human denied — DANGEROUS)")
    typer.echo(
        f"  False denials:      {fn}  (AI denied, human approved — overly cautious)"
    )

    if fp_orgs:
        typer.echo("\n  Wrongly approved orgs:")
        for name in fp_orgs:
            typer.echo(f"    - {name}")

    typer.echo(f"\nTotal cost: ${sum(task.costs):.4f}")

    if output:
        report_data = dataclasses.asdict(report)
        output.write_text(json.dumps(report_data, indent=2, default=str))
        typer.echo(f"Report saved to {output}")


@cli.command()
def optimize(
    dataset_path: Path = typer.Option(
        DEFAULT_DATASET_PATH,
        "--dataset",
        "-d",
        help="Path to dataset JSON (from extract)",
    ),
    max_evals: int = typer.Option(50, "--max-evals", help="GEPA evaluation budget"),
    model: str | None = typer.Option(
        None,
        "--model",
        "-m",
        help="Model for review evals (default: settings.OPENAI_MODEL)",
    ),
    reflection_lm: str | None = typer.Option(
        None,
        "--reflection-lm",
        help="litellm model for GEPA reflection (default: settings.OPENAI_MODEL)",
    ),
    concurrency: int = typer.Option(
        5, "--concurrency", "-c", help="Max concurrent LLM calls"
    ),
    output_dir: Path = typer.Option(
        Path("optimization_results"),
        "--output-dir",
        "-o",
        help="Directory for output files",
    ),
) -> None:
    """Optimize the system prompt with GEPA.

    Runs evolutionary prompt optimization using the extracted dataset.
    Saves the best prompt and a JSON report to the output directory.
    """
    result = run_optimization(
        dataset_path,
        max_metric_calls=max_evals,
        model=model,
        reflection_lm=reflection_lm,
        concurrency=concurrency,
        output_dir=output_dir,
    )

    typer.echo("\n" + "=" * 50)
    typer.echo("GEPA OPTIMIZATION COMPLETE")
    typer.echo("=" * 50)
    typer.echo(f"Candidates explored:  {result['num_candidates']}")
    typer.echo(f"Best val score:       {result['best_score']:.3f}")
    typer.echo(f"Duration:             {result['elapsed']:.0f}s")
    typer.echo(f"Eval cost:            ${result['eval_cost']:.4f}")
    typer.echo(f"\nOptimized prompt:     {result['prompt_path']}")
    typer.echo(f"Full report:          {result['report_path']}")
    typer.echo("=" * 50)


def main() -> None:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )

    try:
        cli()
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()
