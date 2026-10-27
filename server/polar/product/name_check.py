import functools
import re
from typing import Annotated

import structlog
from pydantic import BaseModel, ConfigDict, Field
from pydantic_ai import Agent, Choices
from pydantic_ai.models.typesafe import TypeSafeModel
from pydantic_ai.providers.typesafe import TypeSafeProvider
from typesafe_sdk import AsyncTypeSafeClient

from polar.config import settings

from .schemas import ProductNameCheck

log = structlog.get_logger()

JEV_GATEWAY_URL = "https://gateway-us.pydantic.dev/proxy/jev"
FLAGGED_CONFIDENCE_THRESHOLD = 0.7

FLAGGED_PRODUCT_PHRASES: dict[str, str] = {
    "human services": "consulting, consultation, coaching, mentorship, 1-on-1, 1:1, done-for-you, custom, freelance, call, book a session",
    "sponsorships and donations": "sponsorship, sponsor, donate, donation, tip jar, support my work, buy me a coffee, crowdfunding, fundraiser, patron, contribution",
    "advertising": "advertising, ad placement, sponsored post, sponsored listing, featured listing, promoted listing, banner ads, paid promotion, ad space",
    "lead generation and outreach": "lead generation, leads, prospecting, cold email, cold outreach, bulk email, mass DM, SMS campaign, contact lists, appointment setting, email scraping",
    "marketplaces and resale": "marketplace, vendor, seller commission, revenue share, reseller, third-party sellers, creator marketplace, storefront builder, sell on our platform",
    "adult content": "NSFW, erotic, sexting, adult companion, AI girlfriend, AI boyfriend, OnlyFans, explicit content, nudify, undress AI",
    "gambling": "casino, betting, sportsbook, lottery, raffle, loot box, mystery box, slots, poker, wager, gambling",
    "financial trading and investment advice": "trading bot, forex, crypto signals, stock picks, investment advice, portfolio signals, trading signals, wealth management, NFT, token sale",
    "cheating and circumvention tools": "aimbot, wallhack, game cheats, exam answers, bypass, unlock premium, paywall bypass, account cracking, captcha bypass, anti-detect",
    "personal data lookups": "people search, background check, phone lookup, email lookup, reverse lookup, leaked data, data broker, personal information database",
    "intellectual property infringement": "cracked software, license keys resale, pirated, copyright removal, watermark removal, YouTube downloader, Instagram downloader, content ripper",
    "government services": "visa filing, immigration filing, government forms, tax filing service, passport application, government fee, official filing",
    "job boards": "job posting, job listing, post a job, recruitment marketplace, candidate database, resume database, hiring board, job advertisement",
    "medical advice": "medical consultation, diagnosis, treatment plan, prescription, symptom checker, health advice, medical advice",
    "weapons": "firearms, guns, ammunition, gun parts, weapon training, firearm simulator, ballistics",
    "IPTV and telecom services": "IPTV, M3U playlist, streaming channels, eSIM, SIM activation, VoIP minutes, phone number rental",
    "physical goods": "shipping, delivery, merchandise, physical product, print on demand, dropshipping, inventory, fulfillment",
    "technical support services": "remote repair, PC repair, tech support session, troubleshooting service, device repair, remote assistance",
}

_PATTERNS = {
    category: re.compile(
        rf"\b({'|'.join(map(re.escape, phrases.split(', ')))})s?\b", re.IGNORECASE
    )
    for category, phrases in FLAGGED_PRODUCT_PHRASES.items()
}

FlaggedCategory = Choices(
    {
        category: f"The name means, translates to, or clearly implies something like: {phrases}."
        for category, phrases in FLAGGED_PRODUCT_PHRASES.items()
    },
    name="FlaggedCategory",
)


class ProductNameJudgment(BaseModel):
    """Decide whether a product name describes a product Polar's Acceptable Use Policy forbids."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    category: (
        FlaggedCategory  # type: ignore[valid-type]
        | Annotated[
            None,
            Field(
                description="An ordinary digital product (software, SaaS, course, e-book, template, API) with no connection to any category."
            ),
        ]
    )
    """Which category does the product name describe or sell, read in whichever language it is written and understood as its English meaning?"""


@functools.cache
def jev_agent() -> Agent[None, ProductNameJudgment]:
    return Agent(
        TypeSafeModel(
            "jev-latest",
            provider=TypeSafeProvider(
                typesafe_client=AsyncTypeSafeClient(
                    api_key=settings.PYDANTIC_AI_GATEWAY_API_KEY,
                    base_url=JEV_GATEWAY_URL,
                    compression=False,
                )
            ),
        ),
        output_type=ProductNameJudgment,
    )


def find_flagged_phrase(name: str) -> ProductNameCheck | None:
    for category, pattern in _PATTERNS.items():
        if match := pattern.search(name):
            return ProductNameCheck(category=category, phrase=match.group(0))
    return None


async def check_product_name(name: str) -> ProductNameCheck:
    if flagged := find_flagged_phrase(name):
        return flagged
    try:
        result = await jev_agent().run(name)
    except Exception as e:
        log.warning("product.name_check.jev_failed", error=str(e))
        return ProductNameCheck(category=None, phrase=None)

    confidence = (result.response.provider_details or {}).get("confidence", {})
    category = result.output.category
    if confidence.get("category", 0) < FLAGGED_CONFIDENCE_THRESHOLD:
        category = None
    return ProductNameCheck(category=category, phrase=None)
