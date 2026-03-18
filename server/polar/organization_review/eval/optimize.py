"""GEPA-based system prompt optimization for the organization review agent.

Uses a custom GEPAAdapter that wraps the ReviewAnalyzer, so GEPA evolves
the system prompt while the actual review pipeline stays intact.

Human reviewer reasoning is fed as reflective feedback, giving GEPA
actionable signal about *why* the current prompt fails.
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog

from polar.organization_review.schemas import DataSnapshot, ReviewContext

from .task import CONTEXT_MAP

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Verdict mapping & scoring
# ---------------------------------------------------------------------------

_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
    "NEEDS_HUMAN_REVIEW": "FAIL",
}

# Asymmetric scoring: approving a bad org (false approval) is the most
# dangerous error and scores 0.  Denying a good org (false denial) is
# safe since denied cases always get human review.
WEIGHT_VERDICT_MATCH = 0.20
WEIGHT_NOT_FALSE_APPROVAL = 0.70
WEIGHT_NOT_FALSE_DENIAL = 0.10


def _score(predicted: str, expected: str) -> float:
    """Multi-objective score heavily penalizing false approvals.

    Scores:
      Correct match:    1.0
      False denial:     0.70  (AI denied a good org — safe, human reviews it)
      False approval:   0.0   (AI approved a bad org — DANGEROUS)
    """
    verdict_match = 1.0 if predicted == expected else 0.0
    not_false_approval = (
        0.0 if (expected in ("FAIL", "UNCERTAIN") and predicted == "PASS") else 1.0
    )
    not_false_denial = (
        0.0 if (expected == "PASS" and predicted == "FAIL") else 1.0
    )
    # If the AI approved a bad org, score is 0 regardless of other components
    if not not_false_approval:
        return 0.0

    return (
        WEIGHT_VERDICT_MATCH * verdict_match
        + WEIGHT_NOT_FALSE_APPROVAL * not_false_approval
        + WEIGHT_NOT_FALSE_DENIAL * not_false_denial
    )


# ---------------------------------------------------------------------------
# GEPA adapter
# ---------------------------------------------------------------------------


class ReviewAdapter:
    """Custom GEPA adapter that runs our ReviewAnalyzer pipeline.

    Each candidate prompt is tested by creating a fresh analyzer agent
    with that prompt, running it against the batch of cases, and scoring
    the results.  Human reviewer reasoning is surfaced as reflective
    feedback so GEPA can learn *why* the agent gets cases wrong.
    """

    # Let GEPA use its default reflection LM for proposing new texts
    propose_new_texts = None

    def __init__(self, model: str | None = None, concurrency: int = 5) -> None:
        self._model = model
        self._concurrency = concurrency
        self._analyzers: dict[int, Any] = {}
        self.total_cost = 0.0

    def _get_analyzer(self, prompt: str) -> Any:
        from pydantic_ai import Agent
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.openai import OpenAIProvider

        from polar.config import settings
        from polar.organization_review.analyzer import ReviewAnalyzer
        from polar.organization_review.schemas import ReviewAgentReport

        key = hash(prompt)
        if key not in self._analyzers:
            analyzer = ReviewAnalyzer()
            provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
            analyzer.model = OpenAIChatModel(
                self._model or settings.OPENAI_MODEL, provider=provider
            )
            analyzer.agent = Agent(
                analyzer.model,
                output_type=ReviewAgentReport,
                system_prompt=prompt,
            )
            self._analyzers[key] = analyzer
            # Keep cache bounded
            if len(self._analyzers) > 10:
                del self._analyzers[next(iter(self._analyzers))]
        return self._analyzers[key]

    # -- GEPAAdapter protocol ---------------------------------------------------

    def evaluate(
        self,
        batch: list[dict[str, Any]],
        candidate: dict[str, str],
        capture_traces: bool = False,
    ) -> Any:
        from gepa.core.adapter import EvaluationBatch

        prompt = candidate.get("system_prompt", "")
        analyzer = self._get_analyzer(prompt)
        sem = asyncio.Semaphore(self._concurrency)

        async def _run_one(item: dict[str, Any]) -> tuple[dict, Any, Any]:
            async with sem:
                snapshot = DataSnapshot.model_validate(item["data_snapshot"])
                context = CONTEXT_MAP.get(item["review_type"], ReviewContext.THRESHOLD)
                report, usage = await analyzer.analyze(snapshot, context=context)
                return item, report, usage

        async def _run_batch() -> list[tuple[dict, Any, Any]]:
            return await asyncio.gather(*[_run_one(item) for item in batch])

        results = asyncio.run(_run_batch())

        outputs: list[dict[str, Any]] = []
        scores: list[float] = []
        trajectories: list[dict[str, Any]] | None = [] if capture_traces else None

        for item, report, usage in results:
            self.total_cost += usage.estimated_cost_usd or 0
            predicted = _VERDICT_MAP.get(report.verdict.value, report.verdict.value)
            expected = item["expected_output"]
            score = _score(predicted, expected)

            outputs.append({"predicted": predicted, "expected": expected})
            scores.append(score)

            if trajectories is not None:
                trajectories.append(
                    {
                        "name": item["name"],
                        "predicted": predicted,
                        "expected": expected,
                        "correct": predicted == expected,
                        "summary": report.summary[:300],
                        "human_reason": item.get("human_reason"),
                    }
                )

        return EvaluationBatch(
            outputs=outputs,
            scores=scores,
            trajectories=trajectories,
        )

    def make_reflective_dataset(
        self,
        candidate: dict[str, str],
        eval_batch: Any,
        components_to_update: list[str],
    ) -> dict[str, list[dict[str, Any]]]:
        examples: list[dict[str, Any]] = []
        for traj, score in zip(eval_batch.trajectories or [], eval_batch.scores):
            if score < 1.0:
                feedback = (
                    f"WRONG: predicted {traj['predicted']}, "
                    f"expected {traj['expected']}. "
                    f"Agent summary: {traj['summary']}"
                )
                if traj.get("human_reason"):
                    feedback += (
                        f"\nHuman reviewer's reason for denial: {traj['human_reason']}"
                    )
            else:
                feedback = f"Correct: {traj['predicted']} matches expected."

            examples.append(
                {
                    "Inputs": f"Organization: {traj['name']}",
                    "Generated Outputs": traj["predicted"],
                    "Feedback": feedback,
                }
            )

        return {"system_prompt": examples}


# ---------------------------------------------------------------------------
# Dataset helpers
# ---------------------------------------------------------------------------

OPTIMIZATION_OBJECTIVE = """\
Optimize the compliance review system prompt for a Merchant of Record platform. \
The prompt instructs an LLM to review organizations applying to sell digital products.

The dataset contains cases where the AI incorrectly APPROVED organizations that \
human reviewers later DENIED. These are the most dangerous errors — they let \
risky organizations onto the platform.

Goal: modify the prompt so the AI correctly DENIES these organizations while \
still being fair to legitimate businesses (template sellers, AI SaaS, content \
creation tools, digital education).

The Feedback field in reflective data includes human reviewer reasoning — use \
it to understand patterns the current prompt misses.\
"""


def _cases_to_gepa_format(cases: list[Any]) -> list[dict[str, Any]]:
    """Convert pydantic-evals Cases to the dict format GEPA expects."""
    items = []
    for case in cases:
        items.append(
            {
                "name": case.name,
                "data_snapshot": case.inputs.data_snapshot.model_dump(mode="json"),
                "review_type": case.inputs.review_type,
                "expected_output": case.expected_output,
                "human_reason": (case.metadata.human_reason if case.metadata else None),
            }
        )
    return items


def _split_dataset(
    cases: list[dict[str, Any]],
    val_fraction: float = 0.2,
    seed: int = 42,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Random train/val split."""
    rng = random.Random(seed)
    shuffled = list(cases)
    rng.shuffle(shuffled)
    split_idx = max(1, int(len(shuffled) * val_fraction))
    return shuffled[split_idx:], shuffled[:split_idx]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def run_optimization(
    dataset_path: Path,
    *,
    max_metric_calls: int = 300,
    model: str | None = None,
    reflection_lm: str | None = None,
    val_fraction: float = 0.2,
    concurrency: int = 5,
    output_dir: Path | None = None,
) -> dict[str, Any]:
    """Run GEPA optimization on the review system prompt.

    Args:
        dataset_path: Path to a pydantic-evals dataset JSON (from ``extract``).
        max_metric_calls: GEPA evaluation budget.
        model: Model for running review evaluations.
        reflection_lm: litellm model string for GEPA reflection/mutation.
        val_fraction: Fraction of data to hold out for validation.
        concurrency: Max concurrent LLM calls per evaluation batch.
        output_dir: Directory to save optimized prompt and report.
    """
    import gepa
    from gepa.core.adapter import GEPAAdapter

    from polar.config import settings
    from polar.organization_review.analyzer import SYSTEM_PROMPT

    from .dataset import EvalDataset

    # 1. Load and split dataset
    dataset = EvalDataset.from_file(dataset_path)
    if len(dataset.cases) < 3:
        raise ValueError(f"Need at least 3 cases, got {len(dataset.cases)}")

    gepa_cases = _cases_to_gepa_format(dataset.cases)
    train, val = _split_dataset(gepa_cases, val_fraction=val_fraction)
    log.info(
        "optimize.dataset",
        total=len(gepa_cases),
        train=len(train),
        val=len(val),
    )

    # 2. Resolve reflection LM and set OPENAI_API_KEY for litellm
    effective_reflection_lm = reflection_lm or f"openai/{settings.OPENAI_MODEL}"
    os.environ.setdefault("OPENAI_API_KEY", settings.OPENAI_API_KEY)

    # 3. Run GEPA
    adapter: GEPAAdapter = ReviewAdapter(model=model, concurrency=concurrency)  # type: ignore[assignment]

    log.info(
        "optimize.starting",
        max_metric_calls=max_metric_calls,
        reflection_lm=effective_reflection_lm,
    )
    start = time.monotonic()

    # Save checkpoints so progress survives crashes
    out_dir = output_dir or Path("optimization_results")
    out_dir.mkdir(parents=True, exist_ok=True)
    run_dir = str(out_dir / "gepa_checkpoints")

    result = gepa.optimize(
        seed_candidate={"system_prompt": SYSTEM_PROMPT},
        trainset=train,
        valset=val,
        adapter=adapter,
        reflection_lm=effective_reflection_lm,
        max_metric_calls=max_metric_calls,
        display_progress_bar=True,
        run_dir=run_dir,
    )

    elapsed = time.monotonic() - start
    best_prompt = result.best_candidate.get("system_prompt", "")
    best_score = result.val_aggregate_scores[result.best_idx]
    eval_cost = adapter.total_cost  # type: ignore[union-attr]

    # 4. Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    prompt_path = out_dir / f"system_prompt_{timestamp}.txt"
    prompt_path.write_text(best_prompt)

    report = {
        "timestamp": timestamp,
        "max_metric_calls": max_metric_calls,
        "reflection_lm": effective_reflection_lm,
        "total_cases": len(gepa_cases),
        "train_cases": len(train),
        "val_cases": len(val),
        "num_candidates": result.num_candidates,
        "best_val_score": best_score,
        "elapsed_seconds": elapsed,
        "eval_cost_usd": eval_cost,
    }
    report_path = out_dir / f"report_{timestamp}.json"
    report_path.write_text(json.dumps(report, indent=2, default=str))

    return {
        "prompt_path": str(prompt_path),
        "report_path": str(report_path),
        "best_score": best_score,
        "num_candidates": result.num_candidates,
        "elapsed": elapsed,
        "eval_cost": eval_cost,
    }
