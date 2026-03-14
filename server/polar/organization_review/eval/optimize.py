"""GEPA-based system prompt optimization for the organization review agent.

Uses human-reviewed feedback from organization_review_feedback as ground truth
and GEPA's evolutionary search to optimize the system prompt.

Usage:
    python -m polar.organization_review.eval.optimize [--max-evals 300] [--model gpt-5.2-2025-12-11]

Requires: pip install gepa
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------


async def load_feedback_dataset(
    *,
    context_filter: list[str] | None = None,
    limit: int | None = None,
) -> Any:
    """Load human-reviewed feedback cases from the database."""
    from polar.kit.db.postgres import AsyncReadSessionMaker

    from .dataset import extract_dataset

    async with AsyncReadSessionMaker() as session:
        dataset = await extract_dataset(
            session,
            context_filter=context_filter,
            limit=limit,
        )
    return dataset


def split_dataset(
    dataset: Any,
    val_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[list[Any], list[Any]]:
    """Split dataset cases into train/val sets.

    Stratifies by expected_output so both sets have representative
    PASS/FAIL ratios. Override cases are distributed proportionally.
    """
    import random

    rng = random.Random(seed)
    cases = list(dataset.cases)

    pass_cases = [c for c in cases if c.expected_output == "PASS"]
    fail_cases = [c for c in cases if c.expected_output == "FAIL"]

    rng.shuffle(pass_cases)
    rng.shuffle(fail_cases)

    val_pass = int(len(pass_cases) * val_fraction)
    val_fail = int(len(fail_cases) * val_fraction)

    val_cases = pass_cases[:val_pass] + fail_cases[:val_fail]
    train_cases = pass_cases[val_pass:] + fail_cases[val_fail:]

    rng.shuffle(val_cases)
    rng.shuffle(train_cases)

    return train_cases, val_cases


# ---------------------------------------------------------------------------
# GEPA evaluator
# ---------------------------------------------------------------------------

# Asymmetric weights: false negatives (letting bad orgs through) are more
# dangerous than false positives (blocking good orgs), but false positives
# are the current main problem (77 threshold overrides).
WEIGHT_VERDICT_MATCH = 0.40
WEIGHT_NOT_FALSE_NEGATIVE = 0.35
WEIGHT_NOT_FALSE_POSITIVE = 0.25

_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
    "NEEDS_HUMAN_REVIEW": "FAIL",
}

_CONTEXT_MAP: dict[str, str] = {
    "submission": "submission",
    "setup_complete": "setup_complete",
    "threshold": "threshold",
    "manual": "manual",
}


async def _run_single_eval(
    candidate_prompt: str,
    case: Any,
    model: str | None = None,
) -> tuple[float, str]:
    """Run the review analyzer with a candidate prompt on a single case.

    Returns (score, actionable_side_information).
    """
    from .task import create_review_task

    task_fn = create_review_task(model=model, system_prompt=candidate_prompt)

    predicted = await task_fn(case.inputs)
    expected = case.expected_output

    # Multi-objective scoring
    verdict_match = 1.0 if predicted == expected else 0.0
    not_false_negative = (
        0.0 if (expected in ("FAIL", "UNCERTAIN") and predicted == "PASS") else 1.0
    )
    not_false_positive = (
        0.0 if (expected == "PASS" and predicted == "FAIL") else 1.0
    )

    score = (
        WEIGHT_VERDICT_MATCH * verdict_match
        + WEIGHT_NOT_FALSE_NEGATIVE * not_false_negative
        + WEIGHT_NOT_FALSE_POSITIVE * not_false_positive
    )

    # Build actionable side information (ASI) for GEPA's reflection step
    metadata = case.metadata
    org_name = metadata.organization_name if metadata else "unknown"
    human_reason = metadata.human_reason if metadata else None
    review_context = metadata.review_context if metadata else "unknown"

    asi_parts = [
        f"Organization: {org_name}",
        f"Context: {review_context}",
        f"Expected: {expected}, Predicted: {predicted}",
        f"Match: {'YES' if predicted == expected else 'NO'}",
    ]

    if human_reason:
        asi_parts.append(f"Human reviewer reasoning: {human_reason}")

    if predicted != expected and metadata:
        asi_parts.append(f"Agent verdict was: {metadata.agent_verdict}")
        if metadata.is_override:
            asi_parts.append(
                "This was a human OVERRIDE — the agent got this wrong."
            )

    return score, "\n".join(asi_parts)


def build_gepa_evaluator(
    train_cases: list[Any],
    model: str | None = None,
    concurrency: int = 5,
) -> Any:
    """Build the evaluator function for GEPA's optimize_anything.

    The evaluator runs the candidate system prompt against a minibatch of
    train cases and returns a score + ASI string.
    """
    import asyncio

    async def evaluator(candidate: str) -> dict[str, Any]:
        semaphore = asyncio.Semaphore(concurrency)

        async def run_with_limit(case: Any) -> tuple[float, str]:
            async with semaphore:
                return await _run_single_eval(candidate, case, model=model)

        results = await asyncio.gather(
            *[run_with_limit(case) for case in train_cases],
            return_exceptions=True,
        )

        scores = []
        asi_parts = []
        errors = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors += 1
                asi_parts.append(
                    f"Case {i} ERROR: {type(result).__name__}: {result}"
                )
                continue
            score, asi = result
            scores.append(score)
            if score < 1.0:  # Only include failed cases in ASI for efficiency
                asi_parts.append(asi)

        avg_score = sum(scores) / len(scores) if scores else 0.0
        total = len(results)

        header = (
            f"Score: {avg_score:.3f} "
            f"({sum(1 for s in scores if s >= 1.0)}/{total} perfect, "
            f"{errors} errors)"
        )

        return {
            "score": avg_score,
            "asi": header + "\n\n" + "\n---\n".join(asi_parts),
        }

    return evaluator


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


async def validate_prompt(
    prompt: str,
    val_cases: list[Any],
    model: str | None = None,
    concurrency: int = 5,
) -> dict[str, Any]:
    """Run a prompt against the validation set and return detailed metrics."""
    semaphore = asyncio.Semaphore(concurrency)

    async def run_with_limit(case: Any) -> tuple[Any, float, str]:
        async with semaphore:
            score, asi = await _run_single_eval(prompt, case, model=model)
            return case, score, asi

    results = await asyncio.gather(
        *[run_with_limit(c) for c in val_cases],
        return_exceptions=True,
    )

    scores = []
    false_positives = []
    false_negatives = []
    correct = 0

    for result in results:
        if isinstance(result, Exception):
            continue
        case, score, asi = result
        scores.append(score)
        if score >= 1.0:
            correct += 1
        elif case.expected_output == "PASS":
            false_positives.append(case.metadata.organization_name)
        elif case.expected_output in ("FAIL", "UNCERTAIN"):
            false_negatives.append(case.metadata.organization_name)

    total = len(scores)
    return {
        "accuracy": correct / total if total else 0.0,
        "avg_score": sum(scores) / total if total else 0.0,
        "total": total,
        "correct": correct,
        "false_positives": len(false_positives),
        "false_negatives": len(false_negatives),
        "false_positive_orgs": false_positives,
        "false_negative_orgs": false_negatives,
    }


# ---------------------------------------------------------------------------
# Main optimization entry point
# ---------------------------------------------------------------------------


async def run_optimization(
    *,
    max_metric_calls: int = 300,
    model: str | None = None,
    reflection_lm: str = "openai/gpt-5",
    context_filter: list[str] | None = None,
    limit: int | None = None,
    val_fraction: float = 0.2,
    concurrency: int = 5,
    output_dir: str | None = None,
) -> dict[str, Any]:
    """Run GEPA optimization on the review system prompt.

    Args:
        max_metric_calls: GEPA evaluation budget (100-500 recommended).
        model: Model to use for review evals (default: settings.OPENAI_MODEL).
        reflection_lm: Model for GEPA's reflection/mutation steps.
        context_filter: Only use feedback from these review contexts.
        limit: Max number of feedback cases to load.
        val_fraction: Fraction of data to hold out for validation.
        concurrency: Max concurrent LLM calls per evaluation batch.
        output_dir: Directory to save results. Defaults to
            server/polar/organization_review/eval/optimization_results/.
    """
    from gepa import GEPAConfig, EngineConfig, optimize_anything

    from polar.organization_review.analyzer import SYSTEM_PROMPT

    # 1. Load dataset
    logger.info("optimize.loading_dataset", context_filter=context_filter, limit=limit)
    dataset = await load_feedback_dataset(
        context_filter=context_filter, limit=limit
    )
    total_cases = len(dataset.cases)
    logger.info("optimize.dataset_loaded", total_cases=total_cases)

    if total_cases < 10:
        raise ValueError(
            f"Only {total_cases} cases found — need at least 10 for optimization. "
            "Check that human-reviewed feedback exists in the database."
        )

    # 2. Split train/val
    train_cases, val_cases = split_dataset(dataset, val_fraction=val_fraction)
    logger.info(
        "optimize.split",
        train=len(train_cases),
        val=len(val_cases),
        train_overrides=sum(
            1 for c in train_cases if c.metadata and c.metadata.is_override
        ),
    )

    # 3. Baseline validation
    logger.info("optimize.baseline_validation")
    baseline_metrics = await validate_prompt(
        SYSTEM_PROMPT, val_cases, model=model, concurrency=concurrency
    )
    logger.info("optimize.baseline_results", **baseline_metrics)

    # 4. Build evaluator and run GEPA
    evaluator = build_gepa_evaluator(
        train_cases, model=model, concurrency=concurrency
    )

    logger.info(
        "optimize.starting_gepa",
        max_metric_calls=max_metric_calls,
        reflection_lm=reflection_lm,
    )

    start_time = time.monotonic()
    result = optimize_anything(
        seed_candidate=SYSTEM_PROMPT,
        evaluator=evaluator,
        objective=(
            "Optimize the compliance review system prompt for a Merchant of Record "
            "platform. The prompt instructs an LLM to review organizations applying "
            "to sell digital products.\n\n"
            "KEY PROBLEM: The current prompt produces too many false positives — it "
            "denies legitimate businesses (template sellers, AI tools, content "
            "creation SaaS) that human reviewers later approve. 77 threshold-stage "
            "overrides and 28 submission-stage overrides show this pattern.\n\n"
            "CONSTRAINTS:\n"
            "- Must NOT increase false negatives (letting risky orgs through)\n"
            "- Must maintain clear DENY for: marketplaces, financial advisory, "
            "dating, physical goods, gambling, crypto trading\n"
            "- Must correctly APPROVE: template/asset sellers, AI-powered SaaS, "
            "content creation tools, digital education platforms\n"
            "- The prompt MUST instruct the model to return only APPROVE or DENY\n"
            "- Few-shot examples should calibrate edge cases\n\n"
            "The ASI includes human reviewer reasoning for overridden cases — "
            "these explain WHY the current prompt fails."
        ),
        config=GEPAConfig(
            engine=EngineConfig(max_metric_calls=max_metric_calls),
        ),
    )
    elapsed = time.monotonic() - start_time

    logger.info(
        "optimize.gepa_complete",
        best_score=result.best_score,
        elapsed_seconds=elapsed,
    )

    # 5. Validate optimized prompt
    logger.info("optimize.validating_optimized_prompt")
    optimized_metrics = await validate_prompt(
        result.best_candidate, val_cases, model=model, concurrency=concurrency
    )
    logger.info("optimize.optimized_results", **optimized_metrics)

    # 6. Save results
    out_dir = Path(
        output_dir
        or Path(__file__).parent / "optimization_results"
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save the optimized prompt
    prompt_path = out_dir / f"system_prompt_{timestamp}.txt"
    prompt_path.write_text(result.best_candidate)

    # Save metrics comparison
    report = {
        "timestamp": timestamp,
        "config": {
            "max_metric_calls": max_metric_calls,
            "model": model,
            "reflection_lm": reflection_lm,
            "context_filter": context_filter,
            "train_cases": len(train_cases),
            "val_cases": len(val_cases),
        },
        "baseline": baseline_metrics,
        "optimized": optimized_metrics,
        "improvement": {
            "accuracy_delta": (
                optimized_metrics["accuracy"] - baseline_metrics["accuracy"]
            ),
            "false_positives_delta": (
                optimized_metrics["false_positives"]
                - baseline_metrics["false_positives"]
            ),
            "false_negatives_delta": (
                optimized_metrics["false_negatives"]
                - baseline_metrics["false_negatives"]
            ),
        },
        "gepa": {
            "best_score": result.best_score,
            "elapsed_seconds": elapsed,
        },
    }
    report_path = out_dir / f"report_{timestamp}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str))

    logger.info(
        "optimize.saved",
        prompt_path=str(prompt_path),
        report_path=str(report_path),
    )

    # 7. Print summary
    print("\n" + "=" * 60)
    print("GEPA OPTIMIZATION RESULTS")
    print("=" * 60)
    print(f"\nDataset: {len(train_cases)} train / {len(val_cases)} val cases")
    print(f"GEPA budget: {max_metric_calls} metric calls")
    print(f"Duration: {elapsed:.0f}s")
    print(f"\n{'Metric':<25} {'Baseline':>10} {'Optimized':>10} {'Delta':>10}")
    print("-" * 55)
    print(
        f"{'Accuracy':<25} "
        f"{baseline_metrics['accuracy']:>9.1%} "
        f"{optimized_metrics['accuracy']:>9.1%} "
        f"{report['improvement']['accuracy_delta']:>+9.1%}"
    )
    print(
        f"{'False Positives':<25} "
        f"{baseline_metrics['false_positives']:>10} "
        f"{optimized_metrics['false_positives']:>10} "
        f"{report['improvement']['false_positives_delta']:>+10}"
    )
    print(
        f"{'False Negatives':<25} "
        f"{baseline_metrics['false_negatives']:>10} "
        f"{optimized_metrics['false_negatives']:>10} "
        f"{report['improvement']['false_negatives_delta']:>+10}"
    )
    print(f"\nOptimized prompt: {prompt_path}")
    print(f"Full report:      {report_path}")
    print("=" * 60)

    return report


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Optimize the review system prompt with GEPA"
    )
    parser.add_argument(
        "--max-evals",
        type=int,
        default=300,
        help="GEPA evaluation budget (default: 300)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Model for review evals (default: settings.OPENAI_MODEL)",
    )
    parser.add_argument(
        "--reflection-lm",
        type=str,
        default="openai/gpt-5",
        help="Model for GEPA reflection/mutation (default: openai/gpt-5)",
    )
    parser.add_argument(
        "--context",
        type=str,
        nargs="*",
        default=None,
        help="Filter by review context (e.g., submission threshold)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max feedback cases to load",
    )
    parser.add_argument(
        "--val-fraction",
        type=float,
        default=0.2,
        help="Validation set fraction (default: 0.2)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="Max concurrent LLM calls (default: 5)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory for output files",
    )

    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    asyncio.run(
        run_optimization(
            max_metric_calls=args.max_evals,
            model=args.model,
            reflection_lm=args.reflection_lm,
            context_filter=args.context,
            limit=args.limit,
            val_fraction=args.val_fraction,
            concurrency=args.concurrency,
            output_dir=args.output_dir,
        )
    )


if __name__ == "__main__":
    main()
