"""Eval task: wraps ReviewAnalyzer to produce a verdict from an EvalInput."""

from __future__ import annotations

from typing import Any

from polar.organization_review.analyzer import ReviewAnalyzer
from polar.organization_review.schemas import ReviewContext

from .dataset import EvalInput

# Map from ReviewVerdict (model output) to eval expected output
_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
    "NEEDS_HUMAN_REVIEW": "FAIL",
}

CONTEXT_MAP = {
    "submission": ReviewContext.SUBMISSION,
    "setup_complete": ReviewContext.SETUP_COMPLETE,
    "threshold": ReviewContext.THRESHOLD,
    "manual": ReviewContext.MANUAL,
    "unknown": ReviewContext.THRESHOLD,
}


# Protocol for the task function returned by create_review_task.
# The `costs` attribute tracks per-call USD cost for reporting.
class ReviewTaskFn:
    """Type stub — the actual object is an async function with a .costs list."""

    costs: list[float]

    async def __call__(self, eval_input: EvalInput) -> str:
        raise NotImplementedError


def create_review_task(
    model: str | None = None,
    policy_override: str | None = None,
) -> Any:
    """Create an async task function for pydantic-evals.

    The returned function has a ``.costs`` list that accumulates
    the USD cost of each invocation, so you can ``sum(task.costs)``
    after the eval run.

    Args:
        model: Override the model (uses settings.PYDANTIC_AI_GATEWAY_MODEL if None).
        policy_override: If set, use this policy text instead of fetching live.
    """
    analyzer = ReviewAnalyzer(model)

    costs: list[float] = []

    async def review_task(eval_input: EvalInput) -> str:
        context = CONTEXT_MAP.get(eval_input.review_type, ReviewContext.THRESHOLD)
        report, usage = await analyzer.analyze(
            eval_input.data_snapshot,
            context=context,
            policy_override=policy_override,
        )
        costs.append(usage.estimated_cost_usd or 0)
        return _VERDICT_MAP.get(report.verdict.value, report.verdict.value)

    # Set the name for pydantic-evals reporting
    model_name = analyzer.model_name
    review_task.__name__ = f"review_{model_name}"
    review_task.__qualname__ = review_task.__name__
    review_task.costs = costs  # type: ignore[attr-defined]
    return review_task
