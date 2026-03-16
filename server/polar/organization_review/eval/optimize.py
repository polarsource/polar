"""GEPA-based system prompt optimization for the organization review agent.

Uses human-reviewed feedback from organization_review_feedback as ground truth
and GEPA's evolutionary search to optimize the system prompt.

Usage:
    cd server
    uv run python -m polar.organization_review.eval.optimize --max-evals 30 --limit 20

    # Full run (~$30-50):
    uv run python -m polar.organization_review.eval.optimize --max-evals 300

Requires: pip install gepa
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
    "NEEDS_HUMAN_REVIEW": "FAIL",
}

# Asymmetric weights: the most dangerous error is the AI approving an org
# that a human would deny (letting a bad actor through). This is weighted
# heavily. The reverse (AI denying a legit org) is annoying but safe since
# denied cases always get human review.
WEIGHT_VERDICT_MATCH = 0.30
WEIGHT_NOT_FALSE_NEGATIVE = 0.55  # AI approves, human denies — CRITICAL
WEIGHT_NOT_FALSE_POSITIVE = 0.15  # AI denies, human approves — safe, less important


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------


def _load_cases_from_fixtures() -> list[dict[str, Any]]:
    """Load cases from the fixtures JSON file (offline mode)."""
    fixtures_path = Path(__file__).parent / "fixtures" / "sample_cases.json"
    if not fixtures_path.exists():
        raise FileNotFoundError(
            f"No fixtures at {fixtures_path}. "
            "Run: uv run python -m polar.organization_review.eval.extract_fixtures"
        )
    with open(fixtures_path) as f:
        raw_cases = json.load(f)
    if not raw_cases:
        raise ValueError("Fixtures file is empty")
    return raw_cases


async def _load_cases_from_db(
    *,
    context_filter: list[str] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Load cases from the database via extract_dataset."""
    from polar.kit.db.postgres import AsyncReadSessionMaker

    from .dataset import extract_dataset

    async with AsyncReadSessionMaker() as session:
        dataset = await extract_dataset(
            session,
            context_filter=context_filter,
            limit=limit,
        )

    # Convert pydantic-evals Cases into plain dicts for GEPA's dataset
    cases = []
    for case in dataset.cases:
        cases.append(
            {
                "name": case.name,
                "inputs": case.inputs,
                "expected_output": case.expected_output,
                "metadata": case.metadata,
            }
        )
    return cases


def split_dataset(
    cases: list[dict[str, Any]],
    val_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Stratified train/val split."""
    import random

    rng = random.Random(seed)

    pass_cases = [c for c in cases if c["expected_output"] == "PASS"]
    fail_cases = [c for c in cases if c["expected_output"] != "PASS"]

    rng.shuffle(pass_cases)
    rng.shuffle(fail_cases)

    val_pass = max(1, int(len(pass_cases) * val_fraction))
    val_fail = max(1, int(len(fail_cases) * val_fraction))

    val = pass_cases[:val_pass] + fail_cases[:val_fail]
    train = pass_cases[val_pass:] + fail_cases[val_fail:]

    rng.shuffle(val)
    rng.shuffle(train)

    return train, val


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def _score(predicted: str, expected: str) -> float:
    """Multi-objective score with asymmetric FP/FN weighting."""
    verdict_match = 1.0 if predicted == expected else 0.0
    not_fn = 0.0 if (expected in ("FAIL", "UNCERTAIN") and predicted == "PASS") else 1.0
    not_fp = 0.0 if (expected == "PASS" and predicted == "FAIL") else 1.0

    return (
        WEIGHT_VERDICT_MATCH * verdict_match
        + WEIGHT_NOT_FALSE_NEGATIVE * not_fn
        + WEIGHT_NOT_FALSE_POSITIVE * not_fp
    )


# ---------------------------------------------------------------------------
# GEPA evaluator (per-example, as required by GEPA's Evaluator protocol)
# ---------------------------------------------------------------------------


def make_evaluator(model: str | None = None):
    """Build the GEPA evaluator function.

    GEPA calls this as: evaluator(candidate, example) -> (score, side_info)
    where `candidate` is the system prompt string and `example` is one case
    from the dataset.
    """
    # Cache the analyzer across calls to avoid re-creating it for every eval
    _analyzers: dict[int, Any] = {}

    def _get_or_create_analyzer(candidate_prompt: str):
        from pydantic_ai import Agent
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        from polar.config import settings
        from polar.organization_review.analyzer import ReviewAnalyzer
        from polar.organization_review.schemas import ReviewAgentReport

        key = hash(candidate_prompt)
        if key not in _analyzers:
            analyzer = ReviewAnalyzer()
            model_name = model or settings.OPENAI_MODEL
            provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
            analyzer.model = OpenAIChatModel(model_name, provider=provider)
            analyzer.agent = Agent(
                analyzer.model,
                output_type=ReviewAgentReport,
                system_prompt=candidate_prompt,
            )
            _analyzers[key] = analyzer
            # Keep cache bounded
            if len(_analyzers) > 20:
                oldest = next(iter(_analyzers))
                del _analyzers[oldest]
        return _analyzers[key]

    def evaluator(candidate: Any, example: dict[str, Any]) -> tuple[float, dict[str, Any]]:
        """GEPA evaluator: score a candidate prompt on a single example."""
        from polar.organization_review.schemas import DataSnapshot, ReviewContext

        # GEPA passes candidate as Candidate dict: {"current_candidate": "..."}
        if isinstance(candidate, dict):
            candidate = candidate.get("current_candidate", str(candidate))

        CONTEXT_MAP = {
            "submission": ReviewContext.SUBMISSION,
            "setup_complete": ReviewContext.SETUP_COMPLETE,
            "threshold": ReviewContext.THRESHOLD,
            "manual": ReviewContext.MANUAL,
        }

        # Extract data from the example
        inputs = example["inputs"]
        expected = example["expected_output"]
        metadata = example.get("metadata")

        # Handle both FeedbackReviewInput objects and raw fixture dicts
        if hasattr(inputs, "data_snapshot"):
            snapshot = inputs.data_snapshot
            review_type = inputs.review_type
        else:
            snapshot = DataSnapshot.model_validate(inputs["data_snapshot"])
            review_type = inputs.get("review_type", "threshold")

        context = CONTEXT_MAP.get(review_type, ReviewContext.THRESHOLD)
        analyzer = _get_or_create_analyzer(candidate)

        # Run the async analyzer in the current event loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                report, usage = pool.submit(
                    asyncio.run,
                    analyzer.analyze(snapshot, context=context),
                ).result()
        else:
            report, usage = asyncio.run(
                analyzer.analyze(snapshot, context=context)
            )

        predicted = _VERDICT_MAP.get(report.verdict.value, report.verdict.value)
        score = _score(predicted, expected)

        # Build ASI (actionable side information)
        org_name = snapshot.organization.name
        human_reason = None
        is_override = False
        if metadata:
            if hasattr(metadata, "human_reason"):
                human_reason = metadata.human_reason
                is_override = metadata.is_override
            elif isinstance(metadata, dict):
                human_reason = metadata.get("human_reason")
                is_override = metadata.get("is_override", False)

        side_info: dict[str, Any] = {
            "organization": org_name,
            "expected": expected,
            "predicted": predicted,
            "correct": predicted == expected,
            "agent_verdict": report.verdict.value,
            "risk_level": report.overall_risk_level.value
            if hasattr(report.overall_risk_level, "value")
            else str(report.overall_risk_level),
            "summary": report.summary[:300],
        }

        if human_reason:
            side_info["human_reasoning"] = human_reason
        if is_override and predicted != expected:
            side_info["note"] = "Human OVERRIDE — agent got this wrong"

        # Include dimension details for misses
        if predicted != expected:
            side_info["dimensions"] = [
                {
                    "dim": d.dimension.value
                    if hasattr(d.dimension, "value")
                    else str(d.dimension),
                    "risk": d.risk_level.value
                    if hasattr(d.risk_level, "value")
                    else str(d.risk_level),
                    "findings": d.findings[:3],
                }
                for d in report.dimensions
            ]

        return score, side_info

    return evaluator


# ---------------------------------------------------------------------------
# Validation (runs outside GEPA)
# ---------------------------------------------------------------------------


async def validate_prompt(
    prompt: str,
    val_cases: list[dict[str, Any]],
    model: str | None = None,
    concurrency: int = 5,
) -> dict[str, Any]:
    """Run a prompt against the validation set and return detailed metrics."""
    from .task import create_review_task
    from .dataset import FeedbackReviewInput
    from polar.organization_review.schemas import DataSnapshot

    task_fn = create_review_task(model=model, system_prompt=prompt)
    semaphore = asyncio.Semaphore(concurrency)

    async def eval_one(case: dict[str, Any]) -> tuple[str, str, str]:
        async with semaphore:
            inputs = case["inputs"]
            if hasattr(inputs, "data_snapshot"):
                review_input = inputs
            else:
                snapshot = DataSnapshot.model_validate(inputs["data_snapshot"])
                review_input = FeedbackReviewInput(
                    data_snapshot=snapshot,
                    review_type=inputs.get("review_type", "threshold"),
                )
            predicted = await task_fn(review_input)
            expected = case["expected_output"]
            name = case.get("name", "unknown")
            return name, predicted, expected

    results = await asyncio.gather(
        *[eval_one(c) for c in val_cases],
        return_exceptions=True,
    )

    correct = 0
    false_positives: list[str] = []
    false_negatives: list[str] = []
    total = 0

    for result in results:
        if isinstance(result, Exception):
            logger.warning("validate.error", error=str(result))
            continue
        name, predicted, expected = result
        total += 1
        if predicted == expected:
            correct += 1
        elif expected == "PASS":
            false_positives.append(name)
        elif expected in ("FAIL", "UNCERTAIN"):
            false_negatives.append(name)

    return {
        "accuracy": correct / total if total else 0.0,
        "avg_score": correct / total if total else 0.0,
        "total": total,
        "correct": correct,
        "false_positives": len(false_positives),
        "false_negatives": len(false_negatives),
        "false_positive_orgs": false_positives,
        "false_negative_orgs": false_negatives,
    }


# ---------------------------------------------------------------------------
# Main optimization
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
    use_fixtures: bool = False,
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
        output_dir: Directory to save results.
        use_fixtures: Load from fixtures file instead of database.
    """
    from gepa.optimize_anything import GEPAConfig, EngineConfig, optimize_anything

    from polar.organization_review.analyzer import SYSTEM_PROMPT

    # 1. Load dataset
    logger.info("optimize.loading_dataset")
    if use_fixtures:
        raw_cases = _load_cases_from_fixtures()
        # Convert fixture dicts to the format GEPA expects
        cases = []
        for rc in raw_cases:
            decision_map = {"APPROVE": "PASS", "DENY": "FAIL"}
            cases.append(
                {
                    "name": rc["org_name"],
                    "inputs": {
                        "data_snapshot": rc["data_snapshot"],
                        "review_type": rc["review_type"],
                    },
                    "expected_output": decision_map.get(
                        rc["human_decision"], rc["human_decision"]
                    ),
                    "metadata": {
                        "human_reason": rc.get("human_reason"),
                        "agent_verdict": rc.get("agent_verdict"),
                        "is_override": rc.get("human_decision") != rc.get("agent_verdict"),
                        "review_context": rc.get("review_context", "unknown"),
                    },
                }
            )
    else:
        cases = await _load_cases_from_db(
            context_filter=context_filter, limit=limit
        )

    total_cases = len(cases)
    logger.info("optimize.dataset_loaded", total_cases=total_cases)

    if total_cases < 3:
        raise ValueError(
            f"Only {total_cases} cases — need at least 3 for optimization."
        )

    # 2. Split train/val
    train_cases, val_cases = split_dataset(cases, val_fraction=val_fraction)
    logger.info(
        "optimize.split",
        train=len(train_cases),
        val=len(val_cases),
    )

    # 3. Baseline validation
    logger.info("optimize.baseline_validation")
    baseline_metrics = await validate_prompt(
        SYSTEM_PROMPT, val_cases, model=model, concurrency=concurrency
    )
    logger.info("optimize.baseline_results", **baseline_metrics)

    # 4. Build evaluator and run GEPA
    evaluator = make_evaluator(model=model)

    logger.info(
        "optimize.starting_gepa",
        max_metric_calls=max_metric_calls,
        reflection_lm=reflection_lm,
        train_cases=len(train_cases),
    )

    # Set OPENAI_API_KEY for GEPA's reflection LM (uses litellm)
    from polar.config import settings
    os.environ.setdefault("OPENAI_API_KEY", settings.OPENAI_API_KEY)

    start_time = time.monotonic()
    result = optimize_anything(
        seed_candidate=SYSTEM_PROMPT,
        evaluator=evaluator,
        dataset=train_cases,
        valset=val_cases,
        objective=(
            "Optimize the compliance review system prompt for a Merchant of Record "
            "platform. The prompt instructs an LLM to review organizations applying "
            "to sell digital products.\n\n"
            "HIGHEST PRIORITY: Never approve an organization that should be denied. "
            "When the AI approves a bad actor (marketplace, financial trading, dating, "
            "gambling, crypto, physical goods), that is the most dangerous and costly "
            "error — it lets a risky org onto the platform. This MUST be minimized "
            "above all else.\n\n"
            "SECONDARY: Reduce false denials of legitimate businesses (template "
            "sellers, AI tools, content creation SaaS, digital education). These are "
            "annoying but safe since denied cases always get human review.\n\n"
            "CONSTRAINTS:\n"
            "- Must maintain clear DENY for: marketplaces, financial advisory, "
            "dating, physical goods, gambling, crypto trading\n"
            "- Must correctly APPROVE: template/asset sellers, AI-powered SaaS, "
            "content creation tools, digital education platforms\n"
            "- The prompt MUST instruct the model to return only APPROVE or DENY\n"
            "- Few-shot examples should calibrate edge cases\n\n"
            "The side_info includes human reviewer reasoning for overridden cases — "
            "these explain WHY the current prompt fails."
        ),
        config=GEPAConfig(
            engine=EngineConfig(
                max_metric_calls=max_metric_calls,
                candidate_selection_strategy="pareto",
                display_progress_bar=True,
            ),
        ),
    )
    elapsed = time.monotonic() - start_time

    logger.info(
        "optimize.gepa_complete",
        total_metric_calls=result.total_metric_calls,
        num_candidates=result.num_candidates,
        elapsed_seconds=elapsed,
    )

    # 5. Validate optimized prompt
    # best_candidate is a Candidate (dict subclass). For single-string
    # optimization GEPA uses the key from _STR_CANDIDATE_KEY.
    best_candidate = result.best_candidate
    if isinstance(best_candidate, dict):
        # Single-string mode: dict has one key
        keys = list(best_candidate.keys())
        if len(keys) == 1:
            best_candidate = best_candidate[keys[0]]
        else:
            best_candidate = str(best_candidate)

    logger.info("optimize.validating_optimized_prompt")
    optimized_metrics = await validate_prompt(
        best_candidate, val_cases, model=model, concurrency=concurrency
    )
    logger.info("optimize.optimized_results", **optimized_metrics)

    # 6. Save results
    out_dir = Path(output_dir or Path(__file__).parent / "optimization_results")
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    prompt_path = out_dir / f"system_prompt_{timestamp}.txt"
    prompt_path.write_text(best_candidate)

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
            "accuracy_delta": optimized_metrics["accuracy"] - baseline_metrics["accuracy"],
            "false_positives_delta": (
                optimized_metrics["false_positives"] - baseline_metrics["false_positives"]
            ),
            "false_negatives_delta": (
                optimized_metrics["false_negatives"] - baseline_metrics["false_negatives"]
            ),
        },
        "gepa": {
            "total_metric_calls": result.total_metric_calls,
            "num_candidates": result.num_candidates,
            "elapsed_seconds": elapsed,
        },
    }
    report_path = out_dir / f"report_{timestamp}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str))

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
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Optimize the review system prompt with GEPA"
    )
    parser.add_argument(
        "--max-evals", type=int, default=300,
        help="GEPA evaluation budget (default: 300)",
    )
    parser.add_argument(
        "--model", type=str, default=None,
        help="Model for review evals (default: settings.OPENAI_MODEL)",
    )
    parser.add_argument(
        "--reflection-lm", type=str, default="openai/gpt-5",
        help="Model for GEPA reflection/mutation (default: openai/gpt-5)",
    )
    parser.add_argument(
        "--context", type=str, nargs="*", default=None,
        help="Filter by review context (e.g., submission threshold)",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Max feedback cases to load from DB",
    )
    parser.add_argument(
        "--val-fraction", type=float, default=0.2,
        help="Validation set fraction (default: 0.2)",
    )
    parser.add_argument(
        "--concurrency", type=int, default=5,
        help="Max concurrent LLM calls for validation (default: 5)",
    )
    parser.add_argument(
        "--output-dir", type=str, default=None,
        help="Directory for output files",
    )
    parser.add_argument(
        "--fixtures", action="store_true",
        help="Use fixtures file instead of database",
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
            use_fixtures=args.fixtures,
        )
    )


if __name__ == "__main__":
    main()
