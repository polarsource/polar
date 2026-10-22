import re

import structlog

from polar.integrations.typesafe.client import Question
from polar.integrations.typesafe.client import typesafe as typesafe_client

from .schemas import ProductNameCheck

log = structlog.get_logger()

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

FLAGGED_CATEGORY_THRESHOLD = 0.7

_PATTERNS = {
    category: re.compile(
        rf"\b({'|'.join(map(re.escape, phrases.split(', ')))})s?\b", re.IGNORECASE
    )
    for category, phrases in FLAGGED_PRODUCT_PHRASES.items()
}

_QUESTIONS: dict[str, Question] = {
    category: {
        "type": "noul",
        "instructions": (
            "Does `product_name`, read in whichever language it is written and "
            "understood as its English meaning, describe a product that is or "
            f"sells {category}?"
        ),
        "criteria": {
            "true": f"The name means, translates to, or clearly implies something like: {phrases}.",
            "false": (
                "The name reads as an ordinary digital product (software, SaaS, "
                f"course, e-book, template, API) with no connection to {category}."
            ),
        },
    }
    for category, phrases in FLAGGED_PRODUCT_PHRASES.items()
}


def find_flagged_phrase(name: str) -> ProductNameCheck | None:
    for category, pattern in _PATTERNS.items():
        if match := pattern.search(name):
            return ProductNameCheck(category=category, phrase=match.group(0))
    return None


def pick_flagged_category(probabilities: dict[str, float]) -> str | None:
    if not probabilities:
        return None
    category, probability = max(probabilities.items(), key=lambda item: item[1])
    return category if probability >= FLAGGED_CATEGORY_THRESHOLD else None


async def check_product_name(name: str) -> ProductNameCheck:
    if flagged := find_flagged_phrase(name):
        return flagged
    if not typesafe_client.is_configured:
        return ProductNameCheck(category=None, phrase=None)

    try:
        response = await typesafe_client.system_one({"product_name": name}, _QUESTIONS)
    except Exception as e:
        log.warning("product.name_check.typesafe_failed", error=str(e))
        return ProductNameCheck(category=None, phrase=None)

    probabilities = {
        category: answer["noul"]
        for category, answer in response["answers"].items()
        if answer["type"] == "noul"
    }
    return ProductNameCheck(category=pick_flagged_category(probabilities), phrase=None)
