"""The eval task function — takes ReviewInput, returns a verdict string."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from polar.organization_review.schemas import (
    AccountData,
    DataSnapshot,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    ProductsData,
    ReviewContext,
)

from .dataset import ReviewInput

# Map from ReviewVerdict (model output) to OrganizationReview.Verdict (ground truth)
_VERDICT_MAP = {
    "APPROVE": "PASS",
    "DENY": "FAIL",
}


def build_snapshot(review_input: ReviewInput) -> DataSnapshot:
    """Reconstruct a DataSnapshot from the stored organization_details_snapshot.

    For SUBMISSION context, products/account/identity/metrics are empty.
    """
    details = review_input.details

    org_data = OrganizationData(
        name=review_input.name,
        slug=review_input.name.lower().replace(" ", "-"),
        website=review_input.website,
        about=details.get("about"),
        product_description=details.get("product_description"),
        intended_use=details.get("intended_use"),
        customer_acquisition=details.get("customer_acquisition", []),
        switching_from=details.get("switching_from"),
        previous_annual_revenue=details.get("previous_annual_revenue"),
        socials=review_input.socials,
    )

    from datetime import UTC, datetime

    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=org_data,
        products=ProductsData(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=PaymentMetrics(),
        history=HistoryData(),
        website=None,
        collected_at=datetime.now(UTC),
    )


def create_review_task(
    model: str | None = None,
    context: ReviewContext = ReviewContext.SUBMISSION,
) -> Callable[[ReviewInput], Awaitable[str]]:
    """Create a task function for the eval.

    Args:
        model: Override the model (uses settings.OPENAI_MODEL if None)
        context: Review context to use
    """
    from pydantic_ai import Agent
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    from polar.config import settings
    from polar.organization_review.analyzer import SYSTEM_PROMPT, ReviewAnalyzer
    from polar.organization_review.schemas import ReviewAgentReport

    analyzer = ReviewAnalyzer()

    if model:
        provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        analyzer.model = OpenAIChatModel(model, provider=provider)
        analyzer.agent = Agent(
            analyzer.model,
            output_type=ReviewAgentReport,
            system_prompt=SYSTEM_PROMPT,
        )

    async def review_task(review_input: ReviewInput) -> str:
        snapshot = build_snapshot(review_input)
        report, _usage = await analyzer.analyze(snapshot, context=context)
        return _VERDICT_MAP.get(report.verdict.value, report.verdict.value)

    # Set the name for pydantic-evals reporting
    model_name = model or settings.OPENAI_MODEL
    review_task.__name__ = f"review_{model_name}"
    review_task.__qualname__ = f"review_{model_name}"

    return review_task
