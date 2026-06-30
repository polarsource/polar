from __future__ import annotations

import asyncio

import structlog
from pydantic_ai import Agent

from polar.config import settings

from .feature_catalog import FEATURE_CATALOG
from .schemas import ExtractedPricing

log = structlog.get_logger(__name__)

_CATALOG_LINES = "\n".join(
    f"- {feature.key.value}: {feature.label}" for feature in FEATURE_CATALOG
)

SYSTEM_PROMPT = f"""\
You extract pricing information from a company's pricing page.

Return the HEADLINE PLANS only — the top-level tiers a buyer chooses between
(e.g. Free, Pro, Team, Enterprise). Do NOT emit a separate product for every
instance size, SKU, region, or add-on; those belong in `metrics`. Aim for at
most ~8 plans.

For each plan, choose the single pricing model that best describes it:
- Usage: metered, pay per unit consumed (tokens, requests, GB, seconds).
- Seat: priced per user or seat.
- Tiered: fixed plans or tiers (e.g. $25/mo Pro).
- Hybrid: a base price plus usage on top.
- Flat: one flat price for access.

For `anchor`, give one short, representative price a human would recognise
(e.g. "$20 / user / mo", "$2.50 / M tokens", "$25 / mo Pro", or "Custom").

In `metrics`, list the per-unit rates that plan charges — token prices, compute,
storage, request, and overage rates. Normalize each:
- `unit`: the canonical billing unit. Map the wording to the closest one, e.g.
  "per workspace / per org / per team" -> workspace, "per project" -> project,
  "per seat / per user / per member" -> seat, "per 1M tokens" -> tokens. Use
  `other` only when nothing fits.
- `amount` + `per_quantity`: e.g. "$2.50 / M tokens" -> amount 2.5,
  per_quantity 1000000; "$0.50 / 1K requests" -> amount 0.5, per_quantity 1000.
- `raw`: the original price text.
A flat plan with no per-unit rates has an empty `metrics` list.

In `features`, map this plan's notable entitlements to the CANONICAL FEATURES
below. Only include a feature when the plan genuinely offers it. Add `value`
when a quantity or limit is stated (e.g. "100 GB", "Unlimited"). Canonical
features:
{_CATALOG_LINES}

In `other_features`, put advertised features that do NOT match any canonical
feature, verbatim (used to grow the catalog). Skip generic marketing fluff.

Include free tiers — whether a plan offers a free option, and when that changes,
is important to track. Use "Free" as the anchor for a free plan.

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
        timeout_seconds: int = 180,
    ) -> ExtractedPricing:
        prompt = (
            f"Company: {company_name}\n\n"
            f"Pricing page content:\n\n{markdown[:MAX_CONTENT_CHARS]}"
        )
        result = await asyncio.wait_for(
            self.agent.run(prompt), timeout=timeout_seconds
        )
        return result.output
