from __future__ import annotations

import asyncio

import structlog
from pydantic_ai import Agent

from polar.config import settings

from .schemas import ExtractedPricing

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """\
You extract pricing information from a company's pricing page.

Return every distinct paid product or plan you can find. For each one, choose the
single pricing model that best describes it:
- Usage: metered, pay per unit consumed (tokens, requests, GB, seconds).
- Seat: priced per user or seat.
- Tiered: fixed plans or tiers (e.g. $25/mo Pro).
- Hybrid: a base price plus usage on top.
- Flat: one flat price for access.

For `anchor`, give one short, representative price string a human would recognise
(e.g. "$20 / user / mo", "$2.50 / M tokens", "$25 / mo Pro", or "Custom").

Include free tiers — whether a product offers a free plan, and when that
changes, is important to track. Use "Free" as the anchor for a free plan.

Do not invent prices. If a plan is "contact sales", use "Custom". Set
`confidence` to reflect how clearly the page stated its pricing.
"""

# Cap content to keep the prompt bounded. Generous because single-page sites
# often embed their pricing section deep in a long homepage (well past 20k).
MAX_CONTENT_CHARS = 60_000


class PricingExtractor:
    def __init__(self, model: str | None = None) -> None:
        model_instance, _model_provider, model_name = (
            settings.get_pydantic_gateway_model(model)
        )
        # gpt-5.5+ reasoning models reject any non-default temperature.
        self.agent = Agent(
            model_instance,
            output_type=ExtractedPricing,
            system_prompt=SYSTEM_PROMPT,
            model_settings=(
                {} if model_name.startswith("gpt-5.5") else {"temperature": 0}
            ),
        )
        self.model_name = model_name

    async def extract(
        self,
        company_name: str,
        markdown: str,
        *,
        timeout_seconds: int = 60,
    ) -> ExtractedPricing:
        prompt = (
            f"Company: {company_name}\n\n"
            f"Pricing page content:\n\n{markdown[:MAX_CONTENT_CHARS]}"
        )
        result = await asyncio.wait_for(
            self.agent.run(prompt), timeout=timeout_seconds
        )
        return result.output
