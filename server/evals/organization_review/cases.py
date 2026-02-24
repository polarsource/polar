"""DataSnapshot fixtures for organization review evals.

Each builder function returns a DataSnapshot representing a realistic scenario
the review agent should handle correctly.
"""

from datetime import UTC, datetime

from polar.organization_review.schemas import (
    AccountData,
    DataSnapshot,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    PriorOrganization,
    ProductData,
    ProductsData,
    ReviewContext,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 2, 24, 12, 0, 0, tzinfo=UTC)


def _org(
    name: str = "Acme Inc",
    slug: str = "acme-inc",
    *,
    website: str | None = "https://acme.dev",
    email: str | None = "support@acme.dev",
    about: str | None = None,
    product_description: str | None = None,
    intended_use: str | None = None,
    customer_acquisition: list[str] | None = None,
    future_annual_revenue: int | None = None,
    socials: list[dict[str, str]] | None = None,
) -> OrganizationData:
    return OrganizationData(
        name=name,
        slug=slug,
        website=website,
        email=email,
        about=about,
        product_description=product_description,
        intended_use=intended_use,
        customer_acquisition=customer_acquisition or [],
        future_annual_revenue=future_annual_revenue,
        socials=socials or [],
        created_at=_NOW,
        details_submitted_at=_NOW,
    )


def _products(*items: ProductData) -> ProductsData:
    return ProductsData(products=list(items), total_count=len(items))


def _product(
    name: str,
    *,
    description: str | None = None,
    billing_type: str = "one_time",
    price_cents: int = 2900,
    currency: str = "usd",
) -> ProductData:
    return ProductData(
        name=name,
        description=description,
        billing_type=billing_type,
        visibility="public",
        prices=[{"amount_cents": price_cents, "currency": currency, "amount_type": "fixed"}],
    )


def _verified_identity() -> IdentityData:
    return IdentityData(
        verification_status="verified",
        verified_first_name="Jane",
        verified_last_name="Doe",
        verified_address_country="US",
        verified_dob="1990-03-15",
    )


def _active_account(*, country: str = "US") -> AccountData:
    return AccountData(
        country=country,
        business_type="individual",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        capabilities={"transfers": "active", "card_payments": "active"},
        business_name="Jane Doe",
        business_url="https://acme.dev",
        business_support_address_country=country,
    )


def _clean_history() -> HistoryData:
    return HistoryData(user_email="jane@acme.dev")


def _clean_metrics() -> PaymentMetrics:
    return PaymentMetrics()


# ---------------------------------------------------------------------------
# CASE 1: Legitimate SaaS — should APPROVE
# ---------------------------------------------------------------------------


def legitimate_saas_submission() -> DataSnapshot:
    """Legitimate SaaS company submitting for the first time."""
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=_org(
            name="DevTools Pro",
            slug="devtools-pro",
            website="https://devtools.pro",
            about="Developer productivity tools for engineering teams.",
            product_description="CLI tools and IDE extensions to speed up development workflows.",
            intended_use="Selling software licenses and subscriptions for our developer tools.",
            customer_acquisition=["organic", "developer_communities"],
            future_annual_revenue=50_000,
            socials=[{"platform": "github", "url": "https://github.com/devtools-pro"}],
        ),
        products=_products(),  # No products at submission time
        identity=IdentityData(),  # Not verified at submission
        account=AccountData(),  # No account at submission
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 2: Legitimate SaaS with setup complete — should APPROVE
# ---------------------------------------------------------------------------


def legitimate_saas_setup_complete() -> DataSnapshot:
    """Legitimate SaaS with all steps done — products, identity, account."""
    return DataSnapshot(
        context=ReviewContext.SETUP_COMPLETE,
        organization=_org(
            name="DevTools Pro",
            slug="devtools-pro",
            website="https://devtools.pro",
            about="Developer productivity tools for engineering teams.",
            product_description="CLI tools and IDE extensions to speed up development workflows.",
            intended_use="Selling software licenses and subscriptions for our developer tools.",
            customer_acquisition=["organic", "developer_communities"],
            future_annual_revenue=50_000,
            socials=[{"platform": "github", "url": "https://github.com/devtools-pro"}],
        ),
        products=_products(
            _product("Pro License", description="Annual license for DevTools Pro IDE extension", billing_type="year", price_cents=9900),
            _product("Team License", description="Annual team license for up to 10 seats", billing_type="year", price_cents=49900),
        ),
        identity=_verified_identity(),
        account=_active_account(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 3: Prohibited — gambling site — should DENY
# ---------------------------------------------------------------------------


def prohibited_gambling() -> DataSnapshot:
    """Gambling/betting service — clearly prohibited."""
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=_org(
            name="LuckyBet Casino",
            slug="luckybet-casino",
            website="https://luckybet.casino",
            about="Online casino and sports betting platform.",
            product_description="Casino credits and betting chips for our online gambling platform.",
            intended_use="Selling virtual casino credits to gamblers.",
            customer_acquisition=["ads", "affiliates"],
            future_annual_revenue=500_000,
        ),
        products=_products(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 4: Prohibited — physical goods — should DENY
# ---------------------------------------------------------------------------


def prohibited_physical_goods() -> DataSnapshot:
    """Selling physical merchandise — not supported on Polar."""
    return DataSnapshot(
        context=ReviewContext.SETUP_COMPLETE,
        organization=_org(
            name="TeeShop",
            slug="teeshop",
            website="https://teeshop.com",
            about="Custom printed t-shirts and hoodies.",
            product_description="We sell custom-designed t-shirts, hoodies, and stickers shipped worldwide.",
            intended_use="E-commerce for physical merchandise with worldwide shipping.",
            customer_acquisition=["instagram", "tiktok"],
            future_annual_revenue=80_000,
        ),
        products=_products(
            _product("Custom T-Shirt", description="Custom printed cotton t-shirt, shipped within 5-7 business days", price_cents=2500),
            _product("Hoodie Pack", description="Set of 3 custom hoodies with your design, free shipping", price_cents=8900),
        ),
        identity=_verified_identity(),
        account=_active_account(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 5: Prohibited — adult content — should DENY
# ---------------------------------------------------------------------------


def prohibited_adult_content() -> DataSnapshot:
    """AI-generated NSFW content — prohibited."""
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=_org(
            name="AICompanion",
            slug="ai-companion",
            website="https://ai-companion.io",
            about="AI girlfriend and boyfriend experience.",
            product_description="Premium AI companion with personalized conversations and NSFW image generation.",
            intended_use="Subscription access to our AI companion platform.",
            customer_acquisition=["reddit", "twitter"],
            future_annual_revenue=200_000,
        ),
        products=_products(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 6: Prior denial re-creation — should DENY
# ---------------------------------------------------------------------------


def prior_denial_recreation() -> DataSnapshot:
    """User previously denied, now creating a new org — grounds for auto-deny."""
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=_org(
            name="Fresh Start LLC",
            slug="fresh-start-llc",
            website="https://freshstart.dev",
            about="Digital templates and design resources.",
            product_description="Premium design templates for web developers.",
            intended_use="Selling digital design assets.",
        ),
        products=_products(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=_clean_metrics(),
        history=HistoryData(
            user_email="repeat-offender@example.com",
            has_prior_denials=True,
            has_blocked_orgs=True,
            prior_organizations=[
                PriorOrganization(
                    slug="old-scam-shop",
                    status="denied",
                    review_verdict="FAIL",
                    blocked_at=datetime(2026, 1, 1, tzinfo=UTC),
                ),
            ],
        ),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 7: High financial risk — should flag NEEDS_HUMAN_REVIEW
# ---------------------------------------------------------------------------


def high_financial_risk() -> DataSnapshot:
    """Existing org with alarming refund/dispute rates."""
    return DataSnapshot(
        context=ReviewContext.THRESHOLD,
        organization=_org(
            name="QuickCourse Academy",
            slug="quickcourse-academy",
            website="https://quickcourse.academy",
            about="Online courses for digital marketing.",
            product_description="Video courses and masterclasses on digital marketing strategies.",
            intended_use="Selling premium video courses.",
            customer_acquisition=["youtube", "ads"],
            future_annual_revenue=120_000,
        ),
        products=_products(
            _product("Marketing Masterclass", description="Complete digital marketing course with 40+ hours of video", price_cents=29900),
            _product("SEO Bootcamp", description="Intensive SEO training program", billing_type="month", price_cents=9900),
        ),
        identity=_verified_identity(),
        account=_active_account(),
        metrics=PaymentMetrics(
            total_payments=200,
            succeeded_payments=180,
            total_amount_cents=3_500_000,
            p50_risk_score=45,
            p90_risk_score=82,
            refund_count=30,
            refund_amount_cents=600_000,
            dispute_count=5,
            dispute_amount_cents=120_000,
        ),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 8: Open-source project with sponsorship — should APPROVE
# ---------------------------------------------------------------------------


def open_source_sponsorship() -> DataSnapshot:
    """Open-source maintainer with sponsorship — explicitly allowed."""
    return DataSnapshot(
        context=ReviewContext.SETUP_COMPLETE,
        organization=_org(
            name="fasthttp",
            slug="fasthttp",
            website="https://github.com/fasthttp/fasthttp",
            about="High-performance HTTP library for Go.",
            product_description="Open-source HTTP library. Accepting sponsorships to fund development.",
            intended_use="Sponsorships and donations from users of our open-source library.",
            customer_acquisition=["github", "open_source"],
            future_annual_revenue=10_000,
            socials=[{"platform": "github", "url": "https://github.com/fasthttp"}],
        ),
        products=_products(
            _product("Monthly Sponsor", description="Support fasthttp development with a monthly sponsorship", billing_type="month", price_cents=500),
            _product("Gold Sponsor", description="Gold tier sponsorship with logo on README", billing_type="month", price_cents=5000),
        ),
        identity=_verified_identity(),
        account=_active_account(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 9: Borderline — marketing services — should NEEDS_HUMAN_REVIEW or DENY
# ---------------------------------------------------------------------------


def borderline_marketing_services() -> DataSnapshot:
    """Marketing services — restricted category, requires closer review."""
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=_org(
            name="GrowthHacks",
            slug="growthhacks",
            website="https://growthhacks.io",
            about="Growth marketing tools and consulting services.",
            product_description="We offer marketing automation tools and personalized growth consulting.",
            intended_use="Selling marketing SaaS tools and consulting packages.",
            customer_acquisition=["linkedin", "cold_email"],
            future_annual_revenue=150_000,
        ),
        products=_products(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )


# ---------------------------------------------------------------------------
# CASE 10: Digital templates seller — should APPROVE
# ---------------------------------------------------------------------------


def digital_templates_seller() -> DataSnapshot:
    """Framer/Figma template seller — legitimate digital product business."""
    return DataSnapshot(
        context=ReviewContext.SETUP_COMPLETE,
        organization=_org(
            name="PixelCraft Templates",
            slug="pixelcraft",
            website="https://pixelcraft.design",
            about="Premium Framer and Figma templates for designers.",
            product_description="Hand-crafted website templates for Framer and UI kits for Figma.",
            intended_use="Selling digital design templates and UI kits.",
            customer_acquisition=["twitter", "dribbble"],
            future_annual_revenue=40_000,
            socials=[{"platform": "twitter", "url": "https://twitter.com/pixelcraft"}],
        ),
        products=_products(
            _product("SaaS Landing Page Template", description="Modern SaaS landing page template for Framer with animations", price_cents=4900),
            _product("Complete UI Kit", description="500+ Figma components for web and mobile design", price_cents=7900),
        ),
        identity=_verified_identity(),
        account=_active_account(),
        metrics=_clean_metrics(),
        history=_clean_history(),
        collected_at=_NOW,
    )
