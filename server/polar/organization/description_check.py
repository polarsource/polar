import functools
from dataclasses import dataclass
from typing import Annotated, Literal

import structlog
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, Choices

from polar.kit.jev import jev_model

from .schemas import ProductDescriptionCheck, ProductDescriptionCheckRequest

log = structlog.get_logger()

FLAGGED_CONFIDENCE_THRESHOLD = 0.7
JEV_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class Concern:
    verdict: Literal["CLARIFY", "DENY"]
    criterion: str
    message: str


CONCERNS: dict[str, Concern] = {
    "adult content": Concern(
        "DENY",
        "Adult or pornographic content, sexual services, NSFW material, or AI companions and relationship services.",
        "Polar doesn't support adult content or services.",
    ),
    "AI image or video generation": Concern(
        "DENY",
        "Generates images or video with AI, or starts that generation for the user (prompt builders, model pickers, batch generations), whoever runs the model.",
        "Polar doesn't support products that generate images or video with AI.",
    ),
    "weapons": Concern(
        "DENY",
        "Firearms, weapons, ammunition, or explosives.",
        "Polar doesn't support products related to weapons or explosives.",
    ),
    "watermark removal": Concern(
        "DENY",
        "Removes watermarks from images, video, or documents.",
        "Polar doesn't support watermark removal tools.",
    ),
    "third-party content downloaders": Concern(
        "DENY",
        "Downloads or rips content from third-party platforms such as YouTube, Instagram, or TikTok.",
        "Polar doesn't support tools that download content from third-party platforms.",
    ),
    "license key resale": Concern(
        "DENY",
        "Resells license keys, accounts, or subscriptions for software the seller doesn't own.",
        "Polar doesn't support reselling license keys or software the seller doesn't own.",
    ),
    "MLM and pyramid schemes": Concern(
        "DENY",
        "Multi-level marketing, pyramid schemes, or tools to run them.",
        "Polar doesn't support multi-level marketing or pyramid schemes.",
    ),
    "gambling": Concern(
        "DENY",
        "Gambling or betting, including casinos, sportsbooks, lotteries, raffles, loot boxes, or mystery boxes.",
        "Polar doesn't support gambling or betting products.",
    ),
    "illegal goods or services": Concern(
        "DENY",
        "Illegal or age-restricted goods or services, such as drugs, alcohol, tobacco, stolen data, or hacking others' accounts.",
        "Polar doesn't support illegal or age-restricted goods or services.",
    ),
    "child-directed": Concern(
        "CLARIFY",
        "Made for children, without saying whether it is sold to parents, teachers, or institutions rather than marketed to children directly.",
        "Is your product sold to parents, teachers, or institutions, or marketed directly to children?",
    ),
    "financial trading": Concern(
        "CLARIFY",
        "A trading, investing, or stock tool, without saying whether it only displays information and analytics or executes trades or gives investment advice. Budgeting apps and spreadsheet templates are not this.",
        "Does your product execute trades or give investment advice, or does it only display information and analytics?",
    ),
    "security tools": Concern(
        "CLARIFY",
        "A security, pentesting, or scanning tool, without saying how use is restricted to systems the user owns or may test.",
        "How does your product restrict usage to systems the user owns or has explicit permission to test?",
    ),
    "crypto": Concern(
        "CLARIFY",
        "A crypto or token product, without saying whether it executes or brokers token transactions or only tracks and displays portfolio data.",
        "Does your product execute or broker token transactions, or does it only track and display portfolio data?",
    ),
    "medical or legal advice": Concern(
        "CLARIFY",
        "Explicitly offers medical diagnosis, treatment plans, legal strategy, or actionable legal guidance. General reference, how-to guides, health data processing, and advice in other domains (fitness, cooking, farming) are not this.",
        "Does your product give diagnoses, treatment plans, or legal advice, or is it general reference material?",
    ),
    "lead generation and outreach": Concern(
        "CLARIFY",
        "A lead generation, cold outreach, or bulk messaging tool, without saying what rate limits or consent checks prevent automated bulk outreach.",
        "What controls, such as rate limits or consent verification, prevent automated bulk outreach with your product?",
    ),
    "autonomous AI text generation": Concern(
        "CLARIFY",
        "Generates text content with AI (copy, articles, translations), without saying whether there is human review or it publishes fully autonomously at scale.",
        "Does your product include human review or quality controls, or does it publish AI-generated content autonomously?",
    ),
    "VPN or proxy": Concern(
        "CLARIFY",
        "A VPN or proxy service, without saying how it prevents access to geo-restricted or illegal content.",
        "What controls does your VPN or proxy service have to prevent access to geo-restricted or illegal content?",
    ),
    "e-book authorship": Concern(
        "CLARIFY",
        "An e-book or PDF guide, without saying whether it is written by a human or generated with AI.",
        "Is the content of your e-book or guide written by you, or generated with AI?",
    ),
    "marketplaces": Concern(
        "CLARIFY",
        "A directory or listing platform, without saying whether it is curated or a marketplace where third parties sell their own products.",
        "Is your platform a curated resource, or a marketplace where third parties list and sell their own products?",
    ),
    "pre-orders": Concern(
        "CLARIFY",
        "Pre-orders or early access, without saying when it will be delivered or whether a working version exists.",
        "When will your product be delivered, and does a working version already exist?",
    ),
    "human services": Concern(
        "CLARIFY",
        "Coaching, consulting, or other services, without saying whether it is self-serve software or connects customers with human service providers.",
        "Is your product a self-serve software tool, or does it connect customers with human service providers?",
    ),
}

ProductDescriptionConcern = Choices(
    {category: concern.criterion for category, concern in CONCERNS.items()},
    name="ProductDescriptionConcern",
)


class ProductDescriptionJudgment(BaseModel):
    """Decide whether a seller's product description raises a concern under Polar's Acceptable Use Policy. Polar is a Merchant of Record for digital products. Judge the product as described, not how it could be misused, and pick a concern only when the description raises it."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    concern: (
        ProductDescriptionConcern  # type: ignore[valid-type]
        | Annotated[
            None,
            Field(
                description="A standard digital product (SaaS, developer tool, software, course, e-book, template, digital art) that raises no concern, or whose description already resolves it."
            ),
        ]
    )
    """Which concern does the product description raise, or did a previously denied description of the same product raise?"""


@functools.cache
def jev_agent() -> Agent[None, ProductDescriptionJudgment]:
    return Agent(
        jev_model(timeout=JEV_TIMEOUT_SECONDS), output_type=ProductDescriptionJudgment
    )


def _build_prompt(request: ProductDescriptionCheckRequest) -> str:
    parts = [
        f"Previously denied description: {previous.product_description}"
        for previous in request.history
        if previous.verdict == "DENY"
    ]
    parts.append(
        f"Selling categories: {', '.join(request.selling_categories) or 'Not specified'}"
    )
    parts.append(
        f"Pricing models: {', '.join(request.pricing_models) or 'Not specified'}"
    )
    parts.append(f"Product description: {request.product_description}")
    return "\n".join(parts)


APPROVED = ProductDescriptionCheck(verdict="APPROVE", category=None, message=None)


async def check_product_description(
    request: ProductDescriptionCheckRequest,
) -> ProductDescriptionCheck:
    try:
        result = await jev_agent().run(_build_prompt(request))
    except Exception as e:
        log.warning("organization.description_check.jev_failed", error=str(e))
        return APPROVED

    confidence = (result.response.provider_details or {}).get("confidence", {})
    category = result.output.concern
    if category is None or confidence.get("concern", 0) < FLAGGED_CONFIDENCE_THRESHOLD:
        return APPROVED

    concern = CONCERNS[category]
    return ProductDescriptionCheck(
        verdict=concern.verdict, category=category, message=concern.message
    )
