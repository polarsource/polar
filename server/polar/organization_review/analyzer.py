import asyncio

import genai_prices
import structlog
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings
from polar.organization.ai_validation import _fetch_policy_content

from .schemas import DataSnapshot, ReviewAgentReport, UsageInfo

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = """\
You are an expert compliance and risk analyst for Polar, a Merchant of Record platform \
for digital products. You are reviewing an organization's application to sell on Polar.

Your job is to produce a structured, multi-dimensional risk assessment. You have access \
to significantly more data than the initial screening — including actual products listed, \
payment history, identity verification status, and prior history.

## Review Dimensions

Assess each of these independently:

### 1. Policy Compliance
Evaluate whether the organization's stated business and actual products comply with \
Polar's acceptable use policy. Focus on what they SELL ON POLAR, not their broader \
business. A design agency selling Framer templates is fine. A SaaS company selling \
software licenses is fine. Evaluate the products, not the company category.

Common false positives to avoid:
- Template/asset sellers flagged as "human services" — they sell digital products
- SaaS tools flagged as "marketing services" — they sell software, not services
- Education platforms flagged as "for minors" — evaluate the actual audience
- Open source projects with sponsorship — this is explicitly allowed

### 2. Product Legitimacy
Cross-reference the products listed on Polar with the organization's stated business \
and pricing. Look for mismatches that suggest disguised prohibited businesses, \
unreasonably priced products, or low-quality offerings.

Cross-reference what the organization claims in their setup with what their website actually shows.
Look for mismatches between stated business and actual content, signs of prohibited businesses,
pricing discrepancies between website and Polar listings.

If website content is not available, flag this as a red flag.

### 3. Identity & Trust
Evaluate the identity verification status, account completeness, and social presence. \
Social link should be linked to the user's profile on the platform, and not the organization's social media accounts. \
Unverified identity is a red flag.
Countries with high risk of fraud or money laundering are yellow flags.

### 4. Financial Risk
Assess payment risk scores, refund rates, and dispute history. No payment history is \
neutral (new org), not negative. High refund rates (>5%) or any disputes are red flags.

### 5. Prior History
Check if the user has other organizations on Polar, especially denied or blocked ones. \
Prior denials are a strong signal. Re-creating an organization after denial is grounds \
for automatic denial.

## Verdict Guidelines

- **APPROVE**: All dimensions are low risk (scores < 30), no policy violations, \
legitimate products. Most organizations should be approved.
- **DENY**: Clear policy violations, prior denials with re-creation, confirmed fraud \
signals, or sanctioned country. Be confident before denying.
- **NEEDS_HUMAN_REVIEW**: Mixed signals, borderline cases, or insufficient data to \
make a confident automated decision. When in doubt, flag for human review rather than \
auto-denying.

## Important Notes

- Polar is a Merchant of Record for DIGITAL products. Physical goods and pure human \
services are not supported.
- Be fair and give benefit of the doubt for borderline cases. Flag for human review \
rather than auto-denying.
- Your assessment directly impacts real businesses. False denials harm legitimate \
sellers. False approvals can expose Polar to risk. Balance both.
- Provide specific, actionable findings — not vague concerns.
"""


class ReviewAnalyzer:
    def __init__(self) -> None:
        provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
        self.model = OpenAIChatModel(settings.OPENAI_MODEL, provider=provider)
        self.agent = Agent(
            self.model,
            output_type=ReviewAgentReport,
            system_prompt=SYSTEM_PROMPT,
        )

    async def analyze(
        self, snapshot: DataSnapshot, timeout_seconds: int = 60
    ) -> tuple[ReviewAgentReport, UsageInfo]:
        policy_content = await _fetch_policy_content()

        prompt = self._build_prompt(snapshot, policy_content)

        try:
            result = await asyncio.wait_for(
                self.agent.run(prompt), timeout=timeout_seconds
            )
            run_usage = result.usage()
            estimated_cost: float | None = None
            try:
                price = genai_prices.calc_price(
                    run_usage, self.model.model_name, provider_id="openai"
                )
                estimated_cost = float(price.total_price)
            except Exception:
                log.debug(
                    "review_analyzer.price_calc_failed",
                    model=self.model.model_name,
                )
            usage = UsageInfo(
                input_tokens=run_usage.input_tokens or 0,
                output_tokens=run_usage.output_tokens or 0,
                total_tokens=(run_usage.input_tokens or 0)
                + (run_usage.output_tokens or 0),
                estimated_cost_usd=estimated_cost,
            )
            return result.output, usage
        except TimeoutError:
            log.warning(
                "review_analyzer.timeout",
                organization=snapshot.organization.slug,
                timeout_seconds=timeout_seconds,
            )
            return _timeout_report(), UsageInfo()
        except Exception as e:
            log.error(
                "review_analyzer.error",
                organization=snapshot.organization.slug,
                error=str(e),
            )
            return _error_report(str(e)), UsageInfo()

    def _build_prompt(self, snapshot: DataSnapshot, policy_content: str) -> str:
        org = snapshot.organization
        products = snapshot.products
        account = snapshot.account
        metrics = snapshot.metrics
        history = snapshot.history

        parts = []

        # Organization details
        parts.append("## Organization Details")
        parts.append(f"Name: {org.name}")
        parts.append(f"Slug: {org.slug}")
        if org.website:
            parts.append(f"Website: {org.website}")
        if org.email:
            parts.append(f"Email: {org.email}")
        if org.about:
            parts.append(f"About: {org.about}")
        if org.product_description:
            parts.append(f"Product Description: {org.product_description}")
        if org.intended_use:
            parts.append(f"Intended Use: {org.intended_use}")
        if org.customer_acquisition:
            parts.append(f"Customer Acquisition: {', '.join(org.customer_acquisition)}")
        if org.future_annual_revenue is not None:
            parts.append(f"Expected Annual Revenue: ${org.future_annual_revenue:,}")
        if org.switching_from:
            parts.append(f"Switching From: {org.switching_from}")
        if org.socials:
            socials_str = ", ".join(f"{s['platform']}: {s['url']}" for s in org.socials)
            parts.append(f"Social Links: {socials_str}")

        # Products
        parts.append("\n## Products on Polar")
        if products.total_count == 0:
            parts.append("No products created yet.")
        else:
            parts.append(f"Total products: {products.total_count}")
            for p in products.products[:20]:  # Cap at 20
                status = "archived" if p.is_archived else (p.visibility or "unknown")
                parts.append(f"- {p.name} ({p.billing_type}, {status})")
                if p.description:
                    parts.append(f"  Description: {p.description[:300]}")
                if p.prices:
                    price_strs = []
                    for pr in p.prices:
                        if pr.get("amount_cents") is not None:
                            price_strs.append(
                                f"${pr['amount_cents'] / 100:.2f} {pr.get('currency', 'usd')}"
                            )
                        else:
                            price_strs.append(str(pr.get("amount_type", "unknown")))
                    parts.append(f"  Prices: {', '.join(price_strs)}")

        # Website Content
        if snapshot.website:
            parts.append("\n## Website Content")
            parts.append(
                f"Source: {snapshot.website.base_url} "
                f"({snapshot.website.total_pages_succeeded} page(s) scraped)"
            )
            if snapshot.website.scrape_error:
                parts.append(f"Scrape error: {snapshot.website.scrape_error}")
            if snapshot.website.summary:
                parts.append(snapshot.website.summary)
            elif not snapshot.website.pages and not snapshot.website.scrape_error:
                parts.append("No content could be extracted from the website.")

        # Account & Identity
        parts.append("\n## Account & Identity")
        if account.country:
            parts.append(f"Country: {account.country}")
        if account.business_type:
            parts.append(f"Business Type: {account.business_type}")
        parts.append(
            f"Identity Verification: {account.identity_verification_status or 'unknown'}"
        )
        parts.append(f"Stripe Details Submitted: {account.is_details_submitted}")
        parts.append(f"Charges Enabled: {account.is_charges_enabled}")
        parts.append(f"Payouts Enabled: {account.is_payouts_enabled}")

        # Payment Metrics
        parts.append("\n## Payment Metrics")
        if metrics.total_payments == 0:
            parts.append("No payment history yet (new organization).")
        else:
            parts.append(f"Total Payments: {metrics.total_payments}")
            parts.append(f"Succeeded Payments: {metrics.succeeded_payments}")
            parts.append(f"Total Amount: ${metrics.total_amount_cents / 100:,.2f}")
            if metrics.p50_risk_score is not None:
                parts.append(f"P50 Risk Score: {metrics.p50_risk_score}")
            if metrics.p90_risk_score is not None:
                parts.append(f"P90 Risk Score: {metrics.p90_risk_score}")
            parts.append(
                f"Refunds: {metrics.refund_count} (${metrics.refund_amount_cents / 100:,.2f})"
            )
            if metrics.succeeded_payments > 0:
                refund_rate = metrics.refund_count / metrics.succeeded_payments * 100
                parts.append(f"Refund Rate: {refund_rate:.1f}%")
            parts.append(
                f"Disputes: {metrics.dispute_count} (${metrics.dispute_amount_cents / 100:,.2f})"
            )

        # Prior History
        parts.append("\n## User History")
        if history.user_blocked_at:
            parts.append("WARNING: User account is BLOCKED")
        if history.has_prior_denials:
            parts.append("WARNING: User has DENIED organizations")
        if history.has_blocked_orgs:
            parts.append("WARNING: User has BLOCKED organizations")
        if history.prior_organizations:
            parts.append(f"Other organizations ({len(history.prior_organizations)}):")
            for po in history.prior_organizations:
                flags = []
                if po.review_verdict:
                    flags.append(f"verdict={po.review_verdict}")
                if po.appeal_decision:
                    flags.append(f"appeal={po.appeal_decision}")
                if po.blocked_at:
                    flags.append("BLOCKED")
                flag_str = f" [{', '.join(flags)}]" if flags else ""
                parts.append(f"- {po.slug} (status={po.status}){flag_str}")
        else:
            parts.append("No other organizations for this user.")

        # Policy
        parts.append("\n## Acceptable Use Policy")
        parts.append(policy_content)

        parts.append(
            "\n## Instructions"
            "\nBased on ALL the data above, provide your structured multi-dimensional "
            "risk assessment. Assess each dimension independently, then provide an "
            "overall verdict and recommendation."
        )

        return "\n".join(parts)


def _timeout_report() -> ReviewAgentReport:
    from .schemas import DimensionAssessment, ReviewDimension, ReviewVerdict

    return ReviewAgentReport(
        verdict=ReviewVerdict.NEEDS_HUMAN_REVIEW,
        overall_risk_score=50.0,
        summary="Analysis timed out. Manual review required.",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                score=50.0,
                confidence=0.0,
                findings=["Analysis timed out"],
                recommendation="Manual review required",
            )
        ],
        recommended_action="Manual review required due to timeout.",
    )


def _error_report(error: str) -> ReviewAgentReport:
    from .schemas import DimensionAssessment, ReviewDimension, ReviewVerdict

    return ReviewAgentReport(
        verdict=ReviewVerdict.NEEDS_HUMAN_REVIEW,
        overall_risk_score=50.0,
        summary=f"Analysis failed with error: {error[:200]}. Manual review required.",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                score=50.0,
                confidence=0.0,
                findings=[f"Analysis error: {error[:200]}"],
                recommendation="Manual review required",
            )
        ],
        recommended_action="Manual review required due to analysis error.",
    )


# Module-level singleton
review_analyzer = ReviewAnalyzer()
