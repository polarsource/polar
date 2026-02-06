import asyncio
from typing import Literal

import httpx
import structlog
from markdownify import markdownify
from pydantic import Field
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings
from polar.kit.schemas import Schema
from polar.models.organization import Organization

log = structlog.get_logger(__name__)

# User agents to rotate for website fetching
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]


class OrganizationAIValidationVerdict(Schema):
    verdict: Literal["PASS", "FAIL", "UNCERTAIN"] = Field(
        ..., description="PASS | FAIL | UNCERTAIN - indicates compliance status."
    )
    risk_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Risk score from 0 to 100, where 0 is no risk and 100 is high risk.",
    )
    violated_sections: list[str] = Field(
        default_factory=list,
        description="List of violated sections or bullets from the policy.",
    )
    reason: str = Field(
        ...,
        description="A 1 or 3 line explanation of the verdict and the reasoning behind it. The reason will be shown to our customer.",
    )


class OrganizationAIValidationResult(Schema):
    verdict: OrganizationAIValidationVerdict = Field(
        description="AI validation verdict"
    )
    timed_out: bool = Field(
        default=False, description="Whether the validation timed out"
    )
    model: str = Field(
        ...,
        description="The model used for validation, e.g. 'gpt-4o-mini'.",
    )


SYSTEM_PROMPT = """
    You are a compliance expert analyzing organization details against Polar's acceptable use policy.
    Your task is to evaluate if an organization's intended use aligns with our acceptable use policy.
    Guidelines:
        - Be thorough but fair in your analysis
        - Consider the overall business model and intent
        - Focus on the core business activities described
        - If information is unclear or insufficient, respond with UNCERTAIN
        - Only mark as FAIL if there's clear policy violation
        - Provide specific reasoning for your decision
        - Reference specific policy sections when violations are identified
"""

FALLBACK_POLICY = """
    As your Merchant of Record (MoR), we are the reseller of all digital goods and
    services and focus exclusively on digital products. Therefore we cannot support
    physical goods or entirely human services, e.g consultation or support. In
    addition to not accepting the sale of anything illegal, harmful, abusive,
    deceptive or sketchy.

    ## Acceptable Products & Businesses

    * Software & SaaS
    * Digital products: Templates, eBooks, PDFs, code, icons, fonts, design assets, photos, videos, audio etc
    * Premium content & access: Discord server, GitHub repositories, courses and content requiring a subscription.

    **General rule of acceptable services**

    Digital goods, software or services that can be fulfilled by…

    1. Polar on your behalf (License Keys, File Downloads, GitHub- or Discord invites or private links, e.g premium YouTube videos etc)
    2. Your site/service using our APIs to grant immediate access to digital assets
    or services for customers with a one-time purchase or subscriptions

    Combined with being something you'd proudly boast about in public, i.e nothing illegal, unfair, deceptive, abusive, harmful or shady.

    Don't hesitate to [reach out to us](/support) in advance in case you're unsure if your use case would be approved.

    ## Prohibited Businesses

    <Note>
    **Not an exhaustive list**

    We reserve the right to add to it at any time. Combined with placing your
    account under further review or suspend it in case we consider the usage
    deceptive, fraudulent, high-risk or of low quality for consumers with high
    refund/chargeback risks.
    </Note>

    * Illegal or age restricted, e.g drugs, alcohol, tobacco or vaping products
    * Violates laws in the jurisdictions where your business is located or to which your business is targeted
    * Violates any rules or regulations from payment processors & credit card networks, e.g [Stripe](https://stripe.com/en-se/legal/restricted-businesses)
    * Reselling or distributing customer data to other parties for commercial, promotional or any other reason (disclosed service providers are accepted).
    * Threatens reputation of Polar or any of our partners and payment providers
    * Causes or has a significant risk of refunds, chargebacks, fines, damages, or harm and liability
    * Services used by-, intended for or advertised towards minors
    * Physical goods of any kind. Including SaaS services offering or requiring fulfilment via physical delivery or human services.
    * Human services, e.g marketing, design, web development and consulting in general.
    * Donations or charity, i.e price is greater than product value or there is no exchange at all (pure money transfer). Open source maintainers with sponsorship can be supported - reach out.
    * Marketplaces. Selling others’ products or services using Polar against an upfront payment or with an agreed upon revenue share.
    * Adult services or content. Including by AI or proxy, e.g
    * AI Girlfriend/Boyfriend services.
    * OnlyFans related services.
    * Explicit/NSFW content generated with AI
    * Low-quality products, services or sites, e.g
    * E-books generated with AI or 4 pages sold for \\$50
    * Quickly & poorly executed websites, products or services
    * Services with a lot of bugs and issues
    * Products, services or websites we determine to have a low trust score
    * Fake testimonials, reviews, and social proof. It's deceptive to consumers which is behaviour we do not tolerate.
    * Trademark violations
    * "Get rich" schemes or content
    * Gambling & betting services
    * Regulated services or products
    * Counterfeit goods
    * Job boards
    * NFT & Crypto assets.
    * Cheating: Utilizing cheat codes, hacks, or any unauthorized modifications that alter gameplay or provide an unfair advantage.
    * Reselling Licenses: Selling, distributing, or otherwise transferring software licenses at reduced prices or without proper authorization.
    * Services to circumvent rules or terms of other services: Attempting to bypass, manipulate, or undermine any established rules, gameplay mechanics, or pricing structures of other vendors/games.
    * Financial services, e.g facilitating transactions, investments or balances for customers.
    * Financial advice, e.g content or services related to tax guidance, wealth management, investment strategies etc.
    * IPTV services
    * Virus & Spyware
    * Telecommunication & eSIM Services
    * Products you don’t own the IP of or have the required licenses to resell
    * Advertising & unsolicited marketing services. Including services to:
    * Generate, scrape or sell leads
    * Send SMS/WhatsApp messages in bulk
    * Automate outreach (spam risks)
    * Automate mass content generation & submission across sites
    * API & IP cloaking services, e.g services to circumvent IP bans, API rate limits etc.
    * Products or services associated with pseudo-science; clairvoyance, horoscopes, fortune-telling etc.
    * Travel services, reservation services, travel clubs and timeshares
    * Medical advice services or products, e.g. pharmaceutical, weight loss, muscle building.

    ## Restricted Businesses

    Requires closer review and a higher bar of quality, execution, trust and compliance
    standards to be accepted.

    * Directories & boards
    * Marketing services
    * Pre-orders & Paid waitlist
    * Ticket sales
"""

TECHNICAL_ERROR_VERDICT = OrganizationAIValidationVerdict(
    verdict="UNCERTAIN",
    risk_score=50.0,
    violated_sections=[],
    reason="Technical error during validation. Manual review required.",
)

# Cached policy content - will be fetched once and cached
_cached_policy_content: str | None = None


async def _fetch_policy_content() -> str:
    """Fetch and cache the acceptable use policy content."""
    global _cached_policy_content

    if _cached_policy_content is not None:
        return _cached_policy_content

    try:
        # Fetch the actual policy from the documentation URL
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://polar.sh/docs/merchant-of-record/acceptable-use.md",
                timeout=10.0,
                follow_redirects=True,
            )
            if response.status_code == 200:
                _cached_policy_content = response.text
                log.info("Successfully fetched acceptable use policy from docs")
            else:
                log.warning(
                    "Failed to fetch policy, using fallback",
                    status_code=response.status_code,
                )
                _cached_policy_content = FALLBACK_POLICY
    except Exception as e:
        log.warning("Error fetching policy, using fallback", error=str(e))
        _cached_policy_content = FALLBACK_POLICY

    return _cached_policy_content


async def _fetch_website_content(url: str) -> str | None:
    """
    Fetch website content and convert to markdown.

    Args:
        url: The website URL to fetch

    Returns:
        Markdown content or None if fetch fails
    """
    try:
        import random

        # Select a random user agent to avoid bot detection
        user_agent = random.choice(USER_AGENTS)

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                timeout=10.0,
                follow_redirects=True,
                headers={"User-Agent": user_agent},
            )

            if response.status_code != 200:
                log.info(
                    "Failed to fetch website content",
                    url=url,
                    status_code=response.status_code,
                )
                return None

            # Check content size and enforce 50KB limit
            content = response.text
            max_size = 50 * 1024  # 50KB
            if len(content) > max_size:
                log.info(
                    "Website content exceeds size limit, truncating",
                    url=url,
                    size=len(content),
                    max_size=max_size,
                )
                content = content[:max_size]

            # Convert HTML to markdown
            markdown_content = markdownify(content, heading_style="ATX")

            log.info(
                "Successfully fetched website content",
                url=url,
                content_length=len(markdown_content),
            )

            return markdown_content

    except TimeoutError:
        log.info("Website fetch timed out", url=url)
        return None
    except Exception as e:
        log.info(
            "Error fetching website content",
            url=url,
            error=str(e),
        )
        return None


class OrganizationAIValidator:
    """AI-powered organization details validator using pydantic-ai."""

    def __init__(self) -> None:
        provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        self.model = OpenAIChatModel(settings.OPENAI_MODEL, provider=provider)

        self.agent = Agent(
            self.model,
            output_type=OrganizationAIValidationVerdict,
            system_prompt=SYSTEM_PROMPT,
        )

    def _validate_input(self, organization: Organization) -> None:
        """Validate organization input before AI processing."""
        if not organization:
            raise ValueError("Organization is required")

        if not organization.details:
            raise ValueError("Organization details are required for AI validation")

        if not organization.name:
            raise ValueError("Organization name is required")

        # Check details size to prevent excessive API costs
        details_str = str(organization.details)
        if len(details_str) > 10000:  # 10KB limit
            raise ValueError("Organization details too large for AI validation")

    async def validate_organization_details(
        self, organization: Organization, timeout_seconds: int = 25
    ) -> OrganizationAIValidationResult:
        """
        Validate organization details against acceptable use policy.
        """
        # Validate input first
        self._validate_input(organization)

        timed_out = False

        try:
            # Fetch policy content
            policy_content = await _fetch_policy_content()

            # Prepare organization context
            org_context = await self._prepare_organization_context(organization)

            # Create the validation prompt
            prompt = f"""
            Analyze this organization against our acceptable use policy:

            ORGANIZATION DETAILS:
            {org_context}

            ACCEPTABLE USE POLICY:
            {policy_content}

            Provide your compliance verdict with detailed reasoning.
            """

            # Run AI validation with timeout
            try:
                result = await asyncio.wait_for(
                    self.agent.run(prompt), timeout=timeout_seconds
                )
                verdict = result.output

            except TimeoutError:
                log.warning(
                    "AI validation timed out",
                    organization_id=str(organization.id),
                    timeout_seconds=timeout_seconds,
                )
                timed_out = True
                verdict = OrganizationAIValidationVerdict(
                    verdict="UNCERTAIN",
                    risk_score=50.0,
                    violated_sections=[],
                    reason="Validation timed out. Manual review required.",
                )

            return OrganizationAIValidationResult(
                verdict=verdict, timed_out=timed_out, model=self.model.model_name
            )

        except Exception as e:
            log.error(
                "AI validation failed",
                organization_id=str(organization.id),
                error=str(e),
            )

            verdict = TECHNICAL_ERROR_VERDICT

            return OrganizationAIValidationResult(
                verdict=verdict, timed_out=False, model=self.model.model_name
            )

    async def _prepare_organization_context(self, organization: Organization) -> str:
        """Prepare organization details for AI analysis."""
        details = organization.details or {}

        context_parts = [
            f"Organization Name: {organization.name}",
        ]

        if organization.website:
            context_parts.append(f"Website: {organization.website}")

        if details.get("about"):
            context_parts.append(f"About: {details['about']}")

        if details.get("product_description"):
            context_parts.append(
                f"Product Description: {details['product_description']}"
            )

        if details.get("intended_use"):
            context_parts.append(f"Intended Use: {details['intended_use']}")

        # Fetch and include actual website content if available
        if organization.website:
            website_content = await _fetch_website_content(organization.website)
            if website_content:
                context_parts.append(f"\nWebsite Content:\n{website_content}")

        return "\n".join(context_parts)


validator: OrganizationAIValidator = OrganizationAIValidator()
