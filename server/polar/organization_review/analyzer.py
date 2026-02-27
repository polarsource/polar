import asyncio

import structlog
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings

from .policy import fetch_policy_content
from .schemas import DataSnapshot, ReviewAgentReport, ReviewContext, UsageInfo
from .thresholds import thresholds_for_prompt

log = structlog.get_logger(__name__)

SYSTEM_PROMPT = f"""\
You are an expert compliance and risk analyst for Polar, a Merchant of Record platform \
for digital products. You are reviewing an organization's application to sell on Polar.

Your job is to produce a structured, multi-dimensional risk assessment. You have access \
to lot of data, including actual products listed, payment history, identity verification,\
and prior history of the user.

## Review Dimensions

Assess each of these independently:

### 1. Policy Compliance
Evaluate whether the organization's stated business and actual products comply with \
Polar's acceptable use policy. Focus on what they SELL ON POLAR, not their broader \
business. A design agency selling Framer templates is fine. A SaaS company selling \
software licenses is fine. Evaluate the products, not the company category.

Common false positives to avoid:
- Template/asset sellers flagged as "human services" — they sell digital products
- Education platforms flagged as "for minors" — evaluate the actual audience
- Open source projects with sponsorship — this is explicitly allowed

### 2. Product Legitimacy
Cross-reference the products listed on Polar with the organization's stated business \
and pricing. Look for mismatches that suggest disguised prohibited businesses.

Cross-reference what the organization claims in their setup with what their website actually shows.
Look for mismatches between stated business and actual content, signs of prohibited businesses,
pricing discrepancies between website and Polar listings.

### 3. Identity & Trust
Evaluate the identity verification status, account completeness, and social presence. \
Social link should be linked to the user's profile on the platform, and not the organization's social media accounts. \
Unverified identity is a red flag.
Countries with high risk of fraud or money laundering are yellow flags that requires \
human reviews.

### 4. Financial Risk
Assess payment risk scores, refund rates, charge back rates, authorization rate, and dispute history. \
No payment history is neutral (new org), not negative.

The following thresholds need human review:
{thresholds_for_prompt()}
- any dispute created

### 5. Prior History
Check if the user has other organizations on Polar, especially denied or blocked ones. \
Prior denials are a strong signal. Re-creating an organization after denial is grounds \
for automatic denial.

## Verdict Guidelines

- **APPROVE**: All dimensions are low risk (scores < 40), no policy violations, \
legitimate products. Most organizations should be approved.
- **DENY**: Clear policy violations, prior denials with re-creation, confirmed fraud \
signals, sanctioned country, or edgy payment metrics. Be confident before denying. When you deny, a human \
reviewer will review the decision.

You MUST return only APPROVE or DENY. Never return any other verdict.

## Few-Shot Examples

These examples come from real reviews where a human reviewer confirmed the correct \
verdict. Study them to calibrate your risk assessment.

### Example 1: AI Video Generation SaaS → APPROVE
**Business**: SaaS that auto-generates and auto-publishes short-form videos to social \
platforms. Subscription tiers at $19/$39/$69 per month.
**Agent concern**: Positioning around "generate additional income" and "complete autopilot" \
plus automated mass content publishing could overlap with restricted marketing automation.
**Correct verdict**: APPROVE. The product is a legitimate SaaS tool that generates and \
publishes content. It is not a spam/bulk outreach tool — it creates original video content \
for the user's own accounts. Aggressive marketing copy ("autopilot", income potential) is \
common in SaaS and does not make the product prohibited. Evaluate what the tool DOES. How
it makerts itself is important, but not decisive.
**Lesson**: Software tools that COULD theoretically be misused for spam are not prohibited \
if their primary use case is legitimate content creation or productivity.

### Example 2: AI Content Generation SaaS with Agency Website → APPROVE
**Business**: SaaS selling credits for AI content generation/translation for WordPress. \
Website shows a digital marketing agency offering SEO/ads/design services.
**Agent concern**: Website presents as a marketing agency offering human services, creating \
a mismatch with the SaaS product description.
**Correct verdict**: APPROVE. The key question is what they SELL ON POLAR, not what their \
broader business is. A company can be a marketing agency AND sell a SaaS product. As long \
as the Polar products are software subscriptions/credits with automated digital delivery, \
the parent company's other services are irrelevant.
**Lesson**: Website-to-Polar mismatch is only a red flag when the Polar products themselves \
are prohibited. A design agency selling Figma templates, or a marketing agency selling a \
SaaS tool, is perfectly fine.

### Example 3: Space Rental Marketplace → DENY
**Business**: Online marketplace connecting property owners with creators for short-term \
space rentals for photography/filming. Commission-based revenue with payout routing to hosts.
**Agent concern**: Marketplace model with physical fulfillment and payment facilitation to \
third parties.
**Correct verdict**: DENY. This is a textbook prohibited marketplace: it connects buyers \
and sellers, takes a commission, and routes payments to third-party hosts. The underlying \
product is access to PHYSICAL spaces, not a digital good. Polar explicitly prohibits \
marketplaces and does not support payment splitting/facilitation to third parties.
**Lesson**: Marketplaces are prohibited regardless of how they describe themselves. Key \
signals: commission on transactions, payment routing to third parties, physical/offline \
fulfillment.

### Example 4: Crypto Trading AI Assistant → DENY
**Business**: AI app providing trade setups and real-time analysis for crypto futures \
traders. Monthly subscription and lifetime plans.
**Agent concern**: Financial trading/investment advisory platform.
**Correct verdict**: DENY. An AI that generates trade setups, signals, and recommendations \
for crypto futures is a financial trading/advisory/insights platform — explicitly prohibited. \
Even though the identity is verified and payment metrics are clean, policy non-compliance \
is decisive. Clean financials do not override a prohibited business model.
**Lesson**: Financial trading tools, investment advisory, and trading signal services are \
always prohibited regardless of how they frame it ("research tool", "AI assistant"). \
If it generates trade recommendations, it's advisory.

### Example 5: Dating Platform → DENY
**Business**: Subscription-based dating and community platform for adults 18+. Monthly \
subscriptions plus virtual currency (Seeds/Boosts).
**Agent concern**: Category borders on prohibited adult services with elevated chargeback \
risk.
**Correct verdict**: DENY. Dating services are not allowed under Stripe's Acceptable Use \
Policy, which Polar must follow as a Stripe-based MoR. Even though this is a mainstream \
(non-adult) dating platform with verified identity and clean metrics, the business category \
itself is prohibited by the payment processor.
**Lesson**: Some business categories are prohibited by Stripe's AUP regardless of legitimacy. \
Dating services, even mainstream ones, fall into this category.

## Important Notes

- Polar is a Merchant of Record for DIGITAL products. Physical goods and pure human \
services are not supported.
- Be fair and give benefit of the doubt for borderline cases. Approve rather than \
denying — denied cases are always reviewed by a human.
- Your assessment directly impacts real businesses. False denials harm legitimate \
sellers. False approvals can expose Polar to risk. Balance both.
- Provide specific, actionable findings — not vague concerns.
"""

SUBMISSION_PREAMBLE = """\
This is a SUBMISSION review. The user just created their organization, submitted their details. \
No Stripe account, payments, or products exist yet. \
Assess only: POLICY_COMPLIANCE, PRODUCT_LEGITIMACY, PRIOR_HISTORY. \
Skip IDENTITY_TRUST and FINANCIAL_RISK — set those scores to 0 with confidence 0. \
Identity verification is NOT expected at this stage — unverified identity is normal and should NOT be flagged.

Website leniency: If the website is inaccessible, returns errors, or has minor discrepancies \
with the stated business, do NOT treat this as a red flag. Many legitimate businesses have \
websites that are under construction, temporarily down, or not yet updated. Only flag website \
issues if there is a clear and obvious sign of a prohibited business.

Return only APPROVE or DENY, don't return NEEDS_HUMAN_REVIEW. This is only the first step in the review
process.


## Merchant-Facing Summary (merchant_summary)

In addition to the internal summary, you MUST produce a short merchant_summary (1-2 sentences max). \
This text is shown directly to the merchant, so it must:
- Be helpful, not disclose internal review details
- NEVER mention: website scraping, prior organizations/denials, risk scores, Stripe verification errors, or specific fraud signals
- Focus on what the merchant provided or what general category the issue falls into

Examples for DENY:
- "Seems your product or service fails under financial advice. That's against our policies. Please submit and appeal providing additional information."
- "Seems your product can offer trademark violations. That poses a risk to our policies. Please submit and appeal providing additional information"
- "Your account could not be verified at this time. Please appeal or contact support for assistance"
- "We need additional information to verify your account. Please appeal or contact support."

Examples for APPROVE:
- "Your organization has been approved to sell on Polar."
- "Your account has been verified and is ready to accept payments."
"""

SETUP_COMPLETE_PREAMBLE = """\
This is a SETUP_COMPLETE review. The user just has completed ALL setup steps \
(product created, organization details submitted, payout account connected, identity verified) but has NOT yet \
received any payments. You have access to products, account info, identity status, \
and Stripe account metadata.

Focus on:
- **Product price anomalies**: Flag one-time products priced above $1,000 or recurring \
products above $500/month.
- **Product-business mismatch**: Cross-reference products listed on Polar against the \
organization's stated business. Look for mismatches suggesting a disguised prohibited business.
- **Identity & account signals**:
  - Unverified identity is a red flag. Identity verification errors (e.g. "selfie_mismatch", \
"document_expired") indicate potential fraud even if verification eventually succeeded.
  - Compare the account country with the support address country and the verified address \
country from identity verification — mismatches are yellow flags.
  - Stripe capabilities that are not "active" (e.g. "restricted", "pending") mean Stripe \
itself has concerns about this account.
  - Outstanding requirements_currently_due items at SETUP_COMPLETE stage are unusual.
  - **Stripe verification errors** (requirements.errors) are critical signals. Codes like \
"verification_document_fraudulent", "verification_document_manipulated", or "rejected.fraud" \
in disabled_reason are strong fraud indicators. "verification_failed_keyed_identity" means \
Stripe could not verify the person's identity information.
  - A non-null **disabled_reason** (especially "rejected.*" values) means Stripe itself has \
flagged this account. "requirements.past_due" items are overdue and more concerning than \
"currently_due".
- **Identity cross-reference**: Compare the verified name (from identity document) with \
the Stripe business name and the Polar organization name. For individual accounts, the \
verified name should match the business name. Significant mismatches are yellow flags.
- **Business profile cross-reference**: There are two types of Stripe business, \
individual and business. Compare the Stripe business name and URL with the \
Polar organization name and website. Significant mismatches are yellow flags.
- **Prior history**: Check for prior denials or blocked organizations.

Set FINANCIAL_RISK score to 0 with confidence 0 — no payments have occurred yet.

Website leniency: If the website is inaccessible, returns errors, or has minor discrepancies \
with the stated business, do NOT treat this as a red flag. Many legitimate businesses have \
websites that are under construction, temporarily down, or not yet updated. Only flag website \
issues if there is a clear and obvious sign of a prohibited business.

Return only APPROVE or DENY.
"""


THRESHOLD_PREAMBLE = """\
This is a THRESHOLD review triggered when a payment threshold is hit. \
Perform a comprehensive analysis across ALL five dimensions. \
If website content is not available, flag this as a red flag.

Setup & integration signals to check:
- **Checkout URL consistency**: Success URLs (from checkout links) and return URLs (set via \
the API when creating checkouts programmatically) should point to domains matching the \
organization's website. Mismatched or suspicious domains are yellow flags.
- **Checkout links without benefits**: Checkout links selling products with zero benefits \
mean the customer pays but receives nothing tangible — a red flag if there are no webhooks \
or API keys configured.
- **API & Webhook integration**: Having API keys or webhook endpoints is a positive signal. \
Webhook domains should match the organization's website or known services.

Return only APPROVE or DENY.
"""


MANUAL_PREAMBLE = f"""\
This is a MANUAL review triggered by a human reviewer from the backoffice. \
Perform a comprehensive analysis across ALL five dimensions with full detail.

You have access to ALL available data: products, account info, identity verification, \
payment metrics (if any exist), prior history, and website content.

Key areas to cover thoroughly:

- **Policy compliance & product legitimacy**: Cross-reference products listed on Polar \
against the organization's stated business and website. Look for mismatches suggesting \
a disguised prohibited business. Flag high-priced items (one-time > $1,000, recurring > $500/month). \
If website content is not available, flag this as a red flag.
- **Identity & account signals**:
  - Unverified identity is a red flag. Identity verification errors (e.g. "selfie_mismatch", \
"document_expired") indicate potential fraud even if verification eventually succeeded.
  - Compare the account country with the support address country and the verified address \
country from identity verification — mismatches are yellow flags.
  - Stripe capabilities that are not "active" (e.g. "restricted", "pending") mean Stripe \
itself has concerns about this account.
  - **Stripe verification errors** (requirements.errors) are critical signals. Codes like \
"verification_document_fraudulent", "verification_document_manipulated", or "rejected.fraud" \
in disabled_reason are strong fraud indicators.
  - A non-null **disabled_reason** (especially "rejected.*" values) means Stripe itself has \
flagged this account.
  - Compare the verified name (from identity document) with the Stripe business name and \
the Polar organization name. Significant mismatches are yellow flags.
- **Financial risk** (if payment data exists):
  - Evaluate risk scores, refund rates, chargeback rates, and dispute history.
  - Thresholds:
{thresholds_for_prompt()}
    - any dispute created
  - No payment history is neutral (new org), not negative.
- **Prior history**: Check for prior denials or blocked organizations. Re-creating an \
organization after denial is grounds for automatic denial.

Setup & integration signals to check:
- **Checkout URL consistency**: Success URLs (from checkout links) and return URLs (set via \
the API when creating checkouts programmatically) should point to domains matching the \
organization's website. Mismatched or suspicious domains are yellow flags.
- **Checkout links without benefits**: Checkout links selling products with zero benefits \
mean the customer pays but receives nothing tangible — a red flag if there are no webhooks \
or API keys configured.
- **API & Webhook integration**: Having API keys or webhook endpoints is a positive signal. \
Webhook domains should match the organization's website or known services.

Return only APPROVE or DENY.
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
        self,
        snapshot: DataSnapshot,
        context: ReviewContext = ReviewContext.THRESHOLD,
        timeout_seconds: int = 60,
    ) -> tuple[ReviewAgentReport, UsageInfo]:
        policy_content = await fetch_policy_content()

        prompt = self._build_prompt(snapshot, policy_content)

        instructions = {
            ReviewContext.SUBMISSION: SUBMISSION_PREAMBLE,
            ReviewContext.SETUP_COMPLETE: SETUP_COMPLETE_PREAMBLE,
            ReviewContext.THRESHOLD: THRESHOLD_PREAMBLE,
            ReviewContext.MANUAL: MANUAL_PREAMBLE,
        }.get(context)

        try:
            result = await asyncio.wait_for(
                self.agent.run(prompt, instructions=instructions),
                timeout=timeout_seconds,
            )
            usage = UsageInfo.from_agent_usage(result.usage(), self.model.model_name)
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
        identity = snapshot.identity
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
            parts.append(f"Org Support Email: {org.email}")
        if org.about:
            parts.append(f"About: {org.about}")
        if org.product_description:
            parts.append(f"Product Description: {org.product_description}")
        if org.intended_use:
            parts.append(f"Intended Use: {org.intended_use}")
        if org.customer_acquisition:
            parts.append(f"Customer Acquisition: {', '.join(org.customer_acquisition)}")
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

        # Setup & Integration Signals (only for threshold/manual reviews)
        setup = snapshot.setup
        if snapshot.context in (ReviewContext.THRESHOLD, ReviewContext.MANUAL):
            parts.append("\n## Setup & Integration Signals")

            if setup.checkout_success_urls.unique_urls:
                parts.append(
                    f"Checkout Success URLs ({len(setup.checkout_success_urls.unique_urls)}):"
                )
                for url in setup.checkout_success_urls.unique_urls:
                    parts.append(f"  - {url}")
                parts.append(
                    f"Success URL Domains: {', '.join(setup.checkout_success_urls.domains)}"
                )
            else:
                parts.append("No custom checkout success URLs configured.")

            if setup.checkout_return_urls.unique_urls:
                parts.append(
                    f"Checkout Return URLs ({len(setup.checkout_return_urls.unique_urls)}):"
                )
                for url in setup.checkout_return_urls.unique_urls:
                    parts.append(f"  - {url}")
                parts.append(
                    f"Return URL Domains: {', '.join(setup.checkout_return_urls.domains)}"
                )
            else:
                parts.append("No custom checkout return URLs configured.")

            if setup.checkout_links.total_links > 0:
                parts.append(
                    f"Checkout Links: {setup.checkout_links.total_links} total, "
                    f"{setup.checkout_links.links_without_benefits} without benefits"
                )
                for link in setup.checkout_links.links[:20]:
                    products_str = (
                        ", ".join(link.product_names)
                        if link.product_names
                        else "no products"
                    )
                    benefits_flag = (
                        "has benefits" if link.has_benefits else "NO benefits"
                    )
                    label_str = f" [{link.label}]" if link.label else ""
                    parts.append(f"  - {products_str}{label_str} ({benefits_flag})")
            else:
                parts.append("No checkout links created.")

            parts.append(f"API Keys: {setup.integration.api_key_count}")
            if setup.integration.webhook_urls:
                parts.append(f"Webhooks ({len(setup.integration.webhook_urls)}):")
                for url in setup.integration.webhook_urls:
                    parts.append(f"  - {url}")
                parts.append(
                    f"Webhook Domains: {', '.join(setup.integration.webhook_domains)}"
                )
            else:
                parts.append("No webhook endpoints configured.")

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

        # User Identity (from Stripe Identity VerificationSession)
        parts.append("\n## User Identity")
        parts.append(
            f"Verification Status: {identity.verification_status or 'unknown'}"
        )
        if identity.verification_error_code:
            parts.append(f"Verification Last Error: {identity.verification_error_code}")
        if identity.verified_first_name or identity.verified_last_name:
            parts.append(
                f"Verified Name: {identity.verified_first_name or ''} {identity.verified_last_name or ''}".strip()
            )
        if identity.verified_address_country:
            parts.append(
                f"Verified Address Country: {identity.verified_address_country}"
            )
        if identity.verified_dob:
            parts.append(f"Verified Date of Birth: {identity.verified_dob}")

        # Stripe Connect Account (payout account)
        parts.append("\n## Stripe Connect Account")
        if account.country:
            parts.append(f"Account Country: {account.country}")
        if account.business_type:
            parts.append(f"Business Type: {account.business_type}")
        parts.append(f"Details Submitted: {account.is_details_submitted}")
        parts.append(f"Charges Enabled: {account.is_charges_enabled}")
        parts.append(f"Payouts Enabled: {account.is_payouts_enabled}")
        if account.business_name:
            parts.append(f"Business Name: {account.business_name}")
        if account.business_url:
            parts.append(f"Business URL: {account.business_url}")
        if account.business_support_address_country:
            parts.append(
                f"Support Address Country: {account.business_support_address_country}"
            )
        if account.capabilities:
            cap_strs = [f"{k}={v}" for k, v in account.capabilities.items()]
            parts.append(f"Capabilities: {', '.join(cap_strs)}")
        if account.requirements_disabled_reason:
            parts.append(
                f"WARNING — Disabled Reason: {account.requirements_disabled_reason}"
            )
        if account.requirements_errors:
            error_strs = [
                f"{e['code']}: {e['reason']}" for e in account.requirements_errors
            ]
            parts.append(f"WARNING — Verification Errors: {'; '.join(error_strs)}")
        if account.requirements_past_due:
            parts.append(
                f"Requirements Past Due: {', '.join(account.requirements_past_due)}"
            )
        if account.requirements_currently_due:
            parts.append(
                f"Requirements Currently Due: {', '.join(account.requirements_currently_due)}"
            )
        if account.requirements_pending_verification:
            parts.append(
                f"Requirements Pending Verification: {', '.join(account.requirements_pending_verification)}"
            )

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
        verdict=ReviewVerdict.DENY,
        overall_risk_score=50.0,
        summary="Analysis timed out. Denied for human review.",
        merchant_summary="Error occurred during analysis. Please contact support for assistance.",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                score=50.0,
                confidence=0.0,
                findings=["Analysis timed out"],
                recommendation="Human review required",
            )
        ],
        recommended_action="Human review required due to timeout.",
    )


def _error_report(error: str) -> ReviewAgentReport:
    from .schemas import DimensionAssessment, ReviewDimension, ReviewVerdict

    return ReviewAgentReport(
        verdict=ReviewVerdict.DENY,
        overall_risk_score=50.0,
        summary=f"Analysis failed with error: {error[:200]}. Denied for human review.",
        merchant_summary="Error occurred during analysis. Please contact support for assistance.",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                score=50.0,
                confidence=0.0,
                findings=[f"Analysis error: {error[:200]}"],
                recommendation="Human review required",
            )
        ],
        recommended_action="Human review required due to analysis error.",
    )


# Module-level singleton
review_analyzer = ReviewAnalyzer()
