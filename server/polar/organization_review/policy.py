import httpx
import structlog

log = structlog.get_logger(__name__)

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
    * Marketplaces. Selling others' products or services using Polar against an upfront payment or with an agreed upon revenue share.
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
    * Products you don't own the IP of or have the required licenses to resell
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

# Cached policy content - will be fetched once and cached
_cached_policy_content: str | None = None


async def fetch_policy_content() -> str:
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
