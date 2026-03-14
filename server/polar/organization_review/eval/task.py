"""The eval task function — takes FeedbackReviewInput, returns a verdict string.

Supports two modes:
1. Standard eval: run the current system prompt against the stored DataSnapshot.
2. GEPA optimization: run a *candidate* system prompt against the DataSnapshot.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from polar.organization_review.schemas import ReviewContext

from .dataset import FeedbackReviewInput

# Map from ReviewVerdict (model output) to eval expected output
_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
    "NEEDS_HUMAN_REVIEW": "FAIL",
}

_CONTEXT_MAP = {
    "submission": ReviewContext.SUBMISSION,
    "setup_complete": ReviewContext.SETUP_COMPLETE,
    "threshold": ReviewContext.THRESHOLD,
    "manual": ReviewContext.MANUAL,
}


def create_review_task(
    model: str | None = None,
    system_prompt: str | None = None,
) -> Callable[[FeedbackReviewInput], Awaitable[str]]:
    """Create a task function for the eval.

    Args:
        model: Override the model (uses settings.OPENAI_MODEL if None).
        system_prompt: Override the system prompt (for GEPA optimization).
            If None, uses the default SYSTEM_PROMPT.
    """
    from pydantic_ai import Agent
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    from polar.config import settings
    from polar.organization_review.analyzer import SYSTEM_PROMPT, ReviewAnalyzer
    from polar.organization_review.schemas import ReviewAgentReport

    analyzer = ReviewAnalyzer()

    effective_prompt = system_prompt or SYSTEM_PROMPT
    model_name = model or settings.OPENAI_MODEL

    if model or system_prompt:
        provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        analyzer.model = OpenAIChatModel(model_name, provider=provider)
        analyzer.agent = Agent(
            analyzer.model,
            output_type=ReviewAgentReport,
            system_prompt=effective_prompt,
        )

    async def review_task(review_input: FeedbackReviewInput) -> str:
        snapshot = review_input.data_snapshot
        context = _CONTEXT_MAP.get(
            review_input.review_type, ReviewContext.THRESHOLD
        )
        report, _usage = await analyzer.analyze(snapshot, context=context)
        return _VERDICT_MAP.get(report.verdict.value, report.verdict.value)

    review_task.__name__ = f"review_{model_name}"
    review_task.__qualname__ = f"review_{model_name}"

    return review_task
