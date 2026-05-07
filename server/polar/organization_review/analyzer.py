import asyncio

import structlog
from pydantic_ai import Agent

from polar.config import settings

from .known_domains import known_domains_for_prompt, match_known_domain
from .policy import fetch_policy_content
from .schemas import (
    ActorType,
    DataSnapshot,
    DecisionType,
    ReviewAgentReport,
    ReviewContext,
    UsageInfo,
)
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

### 3. Identity, Trust & History
Evaluate the identity verification status, account completeness, and social presence. \
Social link should be linked to the user's profile on the platform, and not the organization's social media accounts. \
Unverified identity is a red flag.
Countries with high risk of fraud or money laundering are yellow flags that requires \
human reviews.

Whether to weigh the user's other organizations on Polar (prior denials, blocked \
organizations) depends on the review CONTEXT. The context-specific preamble below \
will tell you whether to consider prior history. If the preamble does not mention it, \
do NOT use prior denials as a signal — a fresh organization deserves a fresh look.

### 4. Financial Risk
Assess payment risk scores, refund rates, charge back rates, authorization rate, and dispute history. \
No payment history is neutral (new org), not negative.

The following thresholds need human review:
{thresholds_for_prompt()}

**CRITICAL — Minimum volume requirement**: These thresholds are only meaningful with \
sufficient payment volume. With fewer than 10 succeeded payments, individual refunds or \
auth failures create wildly misleading rates (e.g., 1 refund out of 2 payments = "50% refund rate"). \
Do NOT flag rate-based metrics as HIGH risk when the sample size is below 10 payments. \
Instead, note the limited data and treat rates as inconclusive. Only flag if there are \
clear absolute red flags (e.g., multiple disputes at any volume).

If there are any monthly products above $1000 USD, mark this as a high risk if the organization
is new and has no prior payment history.

Note: older reviews may contain a separate "prior_history" dimension — this has been \
merged into IDENTITY_TRUST. Do NOT output a "prior_history" dimension; assess prior \
history under IDENTITY_TRUST instead.

### 5. Setup Readiness (optional — only when setup/integration data is available)
Evaluate whether the organization is properly set up to sell and deliver products. \
An organization is considered ready to sell if ANY of these conditions is met:
- **Checkout links with benefits**: At least one checkout link has benefits attached \
(customers receive something after payment).
- **API keys + checkout return URLs**: The org has API keys AND checkout return URLs configured \
(indicates programmatic checkout creation with a frontend integration).
- **API keys + working webhooks**: The org has API keys AND at least one enabled webhook \
(webhooks are auto-disabled after 10 consecutive failures, so enabled = working).

If NONE of these conditions is met, the org has no delivery mechanism — customers pay \
but receive nothing. This is a red flag.

Additionally, validate domain consistency: checkout return URL domains and webhook \
domains should match the organization's website domain. If they don't match (and are \
not known service domains), this is a MEDIUM risk concern — it suggests the integration \
may point to an unrelated or suspicious destination.

**Redirect detection (CRITICAL):** We follow redirects on checkout success and return \
URLs. If any URL redirects to a DIFFERENT domain than the original, this is a HIGH risk \
signal. Scammers use their own API endpoints as success URLs that then redirect users \
to prohibited content (adult sites, gambling, etc.). Any cross-domain redirect from a \
checkout URL is a strong red flag and should be treated as HIGH risk unless the final \
destination is a known service domain.

**Pricing setup**: How the organization has configured its prices is part of how it's \
set up to sell. Custom and ad-hoc pricing should be judged differently:

- **Pay-what-you-want (custom amount_type)** — contextual. Not a red flag on its own.
  - Legitimate fit: open-source sponsorship, creator/community support, donations to a \
project, tipping. PWYW is the EXPECTED model here.
  - Suspicious fit: SaaS subscriptions, software licenses, human services (web design, \
consulting), or any product with a defined deliverable and market price. A SaaS that \
charges "whatever the customer enters" doesn't make sense as a business model — flag here.

- **Ad-hoc prices (catalog price overridden via API at checkout)** — edgy. The public \
catalog price is not what's actually being charged: each checkout gets a one-off price. \
A $1 catalog product paired with ad-hoc prices is the classic abuse pattern. If the \
ad-hoc count is non-zero, default to DENY so a human reviews it — UNLESS the prior \
human-approval rule applies (a previous human reviewer already approved this org with \
the same ad-hoc pricing pattern in view). Don't re-raise a concern a human has already \
resolved.

## Verdict Guidelines

- **APPROVE**: All dimensions are LOW risk, no policy violations, \
legitimate products. Most organizations should be approved.
- **DENY**: Clear policy violations, prior denials with re-creation, confirmed fraud \
signals, sanctioned country, or edgy payment metrics. Be confident before denying.

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

### Example 6: Design Agency Selling Framer Templates → APPROVE
**Business**: Framer templates sold as one-time digital products. Website shows a design \
studio offering custom web design, branding, and monthly retainer services.
**Agent concern**: Website presents human services (design, web development), creating a \
mismatch with digital product sales.
**Correct verdict**: APPROVE. The Polar products are digital templates — fully automated \
delivery, no human fulfillment. Many independent designers run a service business AND sell \
digital assets. Evaluate what they SELL ON POLAR (templates), not what their broader \
business does (design services). A services website is NOT grounds for denial if the Polar \
products are clearly digital.
**Lesson**: Indie creators often have a services website but sell digital products on Polar. \
This is normal and expected. Only deny if the Polar products themselves require human delivery.

### Example 7: AI Text Humanizer Tool → APPROVE
**Business**: SaaS that rewrites AI-generated text to sound more natural. Subscription \
and credit-based pricing.
**Agent concern**: Could be used to bypass AI detection in academic settings (Turnitin, \
GPTZero), which may constitute "circumventing rules or terms of other services."
**Correct verdict**: APPROVE. The tool rewrites text — it does not directly interact with \
or circumvent any third-party service. Users may apply it to academic work, but the tool \
itself is a general-purpose writing assistant. Polar does not police end-user intent for \
legitimate software tools. Many SaaS products COULD be misused; that does not make them \
prohibited.
**Lesson**: A tool that CAN be used for circumvention is not the same as a tool DESIGNED \
for circumvention. Evaluate the tool's primary function, not hypothetical misuse scenarios. \
VPNs, ad blockers, and text rewriters are all legitimate software categories.

### Example 8: Testimonial Collection SaaS → APPROVE
**Business**: SaaS platform for collecting, managing, and displaying customer testimonials \
on websites. Subscription pricing.
**Agent concern**: Overlaps with "fake testimonials/reviews/social proof" prohibition.
**Correct verdict**: APPROVE. This is a legitimate SaaS tool for collecting REAL testimonials \
from REAL customers. The prohibition targets platforms that fabricate fake reviews or \
artificially inflate social proof. A tool that helps businesses collect and display genuine \
customer feedback is the opposite of that — it promotes transparency.
**Lesson**: Read the policy carefully. "Fake testimonials" means fabricated/fraudulent reviews, \
not tools that manage real customer feedback.

### Example 9: Open Source Project with Pay-What-You-Want → APPROVE (Threshold)
**Business**: Open source developer tool with a "Support this project" checkout link. \
One-time payment, no benefits attached. Low volume (3 payments).
**Agent concern**: Checkout has no benefits, looks like a donation. Low volume makes metrics \
unreliable.
**Correct verdict**: APPROVE. Open source sponsorship/support is EXPLICITLY allowed on Polar. \
Pay-what-you-want and voluntary support payments are a core use case. The lack of "benefits" \
is expected — the user is supporting the project, not buying a product. Do not confuse this \
with prohibited "donations" (which refers to charity/non-profit fundraising, not open source support).
**Lesson**: Open source project support is always acceptable. Low volume with no benefits is \
normal for this category — do not flag it.

### Example 9b: SaaS with $1 Catalog Product + Ad-hoc Prices → DENY (human review)
**Business**: Self-described SaaS in private beta. Catalog has a $1 fixed-price product \
and a separate product for "human services (web development)". Many ad-hoc prices have been \
created at checkout, billing amounts well above $1.
**Agent concern**: Ad-hoc pricing exists on the account.
**Correct verdict**: DENY. Ad-hoc prices alone are enough to route this to a human reviewer, \
and the rest of the picture reinforces that decision: the $1 catalog listing is a façade \
(the real prices are set per-checkout, hidden from the public catalog), the stated business \
is a SaaS where defined tiers are expected, and the separate "human services" product is \
itself unsupported (Polar does not handle pure human services). A human reviewer can confirm \
or override; the agent should not auto-approve.
**Lesson**: Ad-hoc prices are edgy on their own — default to DENY so a human looks at it. \
Pay-what-you-want is contextual (fine for OSS support, suspicious for SaaS), but ad-hoc \
prices override the catalog itself and are a structural mismatch with how a public catalog \
is supposed to work. When in doubt, DENY and let a human approve. Exception: if a prior \
human reviewer already approved this org while the same ad-hoc pricing was in place, \
trust that approval and do not re-raise.

### Example 10: Small-Volume Org with High Refund Rate → APPROVE (Threshold)
**Business**: Legitimate SaaS with 3 succeeded payments and 1 refund (33% refund rate). \
Product and website look fine. Verified identity.
**Agent concern**: Refund rate 33% exceeds the 15% critical threshold.
**Correct verdict**: APPROVE. With only 3 payments, a single refund creates a misleading \
33% rate. This is statistical noise, not a pattern. Apply financial thresholds only when \
there is meaningful volume (10+ payments). At low volumes, look at absolute numbers: \
1 refund is completely normal for a new business. The product and identity check out.
**Lesson**: Rate-based metrics on tiny samples are meaningless. 1 out of 3 is not the same \
as 333 out of 1000. Always consider sample size before flagging financial metrics.

### Example 11: Finance Calculator App → APPROVE
**Business**: Personal budgeting and expense tracking app. SaaS subscription.
**Agent concern**: Could overlap with "financial services" or "financial advice" prohibition.
**Correct verdict**: APPROVE. A budgeting app that helps users track their own expenses is \
a productivity tool, not a financial service. It does not facilitate transactions, provide \
investment advice, manage portfolios, or offer trading capabilities. The "financial services" \
prohibition targets platforms that handle money on behalf of users (trading, brokerage, \
investment advisory), not tools that help users understand their own spending.
**Lesson**: "Financial" in the product name does not mean "financial services." Evaluate what \
the tool actually does: calculators, trackers, and budgeting tools are productivity software.

### Example 12: Personal Finance Tracker → APPROVE
**Business**: SaaS app for tracking personal expenses, budgets, and portfolio allocation. \
Subscription pricing. Website mentions "financial insights" and "smart money management."
**Agent concern**: Could be classified as "financial services" or "investment advisory."
**Correct verdict**: APPROVE. This is a productivity/tracking tool — it reads data, \
it does not move money, give investment recommendations, or execute trades. The "financial \
services" prohibition targets platforms that handle money on behalf of users: trading, \
brokerage, lending, money transmission, investment management. A tool that helps users \
understand their own spending is software, not a financial service.
**Lesson**: A product with "financial" in its name or description is NOT automatically \
"financial services." Ask: does it handle money, give investment advice, or execute trades? \
If no, it is a productivity tool.

### Example 13: Exam Practice App → APPROVE
**Business**: App with practice questions for professional certifications. The questions are \
original (written by the team), not copied from actual exams. Subscription pricing.
**Agent concern**: "Exam prep" could overlap with "standardized test circumvention" or \
"academic dishonesty."
**Correct verdict**: APPROVE. This is an educational product selling original practice \
content. It does not provide actual exam answers, leaked questions, or tools to cheat \
during exams. The prohibition targets products that help users cheat on or circumvent \
specific standardized tests, not educational tools that help users learn the material.
**Lesson**: "Exam practice" ≠ "exam cheating." Original practice questions are educational \
content. Only deny if the product explicitly sells real exam answers or circumvention tools.

### Example 14: Content Marketing SaaS → APPROVE
**Business**: SaaS that generates social media posts, blog drafts, and marketing copy \
for the user's own brand. Subscription and credit-based pricing.
**Agent concern**: "Marketing automation" or "bulk content generation" could overlap with \
spam/unsolicited outreach restrictions.
**Correct verdict**: APPROVE. The tool generates content for the USER'S OWN accounts \
and channels — it does not send unsolicited messages to third parties. The spam/outreach \
prohibition targets tools that send mass emails, DMs, or messages to people who did not \
opt in. A content creation tool for your own marketing is standard SaaS.
**Lesson**: "Content generation for own channels" ≠ "spam/unsolicited outreach." The key \
distinction is WHO receives the content: the user's own audience (fine) vs. unsolicited \
recipients (prohibited).

### Example 15: Chat Mockup / Message Generator Tool → DENY borderline, APPROVE
**Business**: SaaS that generates realistic-looking chat screenshots for marketing, \
social proof, and entertainment. One-time purchase.
**Agent concern**: Could be used to create fake conversations, impersonate people, or \
fabricate social proof.
**Correct verdict**: APPROVE (borderline). The tool generates obviously synthetic chat \
screenshots for marketing materials and entertainment — similar to stock photo services. \
It is not positioned for fraud or impersonation. While it could theoretically be misused, \
its stated purpose is content creation. The "fake testimonials" prohibition targets platforms \
that fabricate reviews to deceive consumers, not creative tools for generating example content.
**Lesson**: Tools that COULD be misused for deception are not automatically prohibited. \
Evaluate the product's stated purpose and primary use case, not hypothetical misuse scenarios.

## Grounding Rule — Quote Before You Deny

**CRITICAL**: Before denying an organization, you MUST identify the SPECIFIC policy \
section that is violated. Ask yourself:
1. What EXACTLY does this organization sell on Polar?
2. Which SPECIFIC prohibited category does it fall under?
3. Can I point to a concrete policy rule that this product violates?

If you cannot answer all three with specific evidence from the data, you MUST approve. \
Vague concerns like "could overlap with financial services" or "might be marketing automation" \
are NOT sufficient grounds for denial. You need concrete evidence, not pattern matching.

Common false-positive patterns to catch yourself on:
- "Financial" in the name → check: does it actually handle money or give investment advice?
- "Exam/test" → check: original practice content or actual exam cheating?
- "Marketing" → check: user's own channels or unsolicited mass outreach?
- "Services" on website → check: what do they SELL ON POLAR specifically?

## Overall Risk Level

After assessing each dimension, provide an overall_risk_level:
- LOW: All dimensions are low risk
- MEDIUM: Some concerns but no clear violations
- HIGH: Serious risk signals or clear violations


## Response
Keep responses concise and to the point. For example:

### Example: Approve of digital framing business
- verdict: APPROVE
- summary: sells digital framing products, payment metrics looks healthy, and website appears legimitate for what they have been selling.
- recommended_action: none


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
Assess only: POLICY_COMPLIANCE, PRODUCT_LEGITIMACY, IDENTITY_TRUST. \
Skip FINANCIAL_RISK and SETUP_READINESS — set those to LOW risk with confidence 0. \
Identity verification is NOT expected at this stage — unverified identity is normal and should NOT be flagged. \
At submission time, do NOT use prior denied or blocked organizations as a signal — \
the user deserves a fresh review based on this submission's content alone. Set IDENTITY_TRUST \
to LOW with confidence 0 unless there is a concrete identity-related red flag in this submission.

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

THRESHOLD_PREAMBLE = f"""\
This is a THRESHOLD review triggered when a payment threshold is hit. \
Perform a comprehensive analysis across ALL five dimensions, including SETUP_READINESS.

**CRITICAL — Prior human approval trust**: If the "Prior Review Decisions" section shows \
that a HUMAN reviewer (actor=human) has already APPROVED this organization, you should \
strongly default to APPROVE. A human approval is a high-confidence trust signal that \
overrides agent-level concerns. Specifically:

- Do NOT re-raise the SAME concerns that were raised in prior agent reviews and resolved \
by a human approval. This includes: setup/integration concerns, website concerns, \
cross-domain redirects, missing webhooks, missing checkout link benefits, domain \
mismatches, ad-hoc / pay-what-you-want pricing concerns, and policy concerns the human \
already considered.
- The ONLY reasons to deny an org with prior human approval are:
  1. NEW evidence of a clearly prohibited business (e.g., the org pivoted to selling \
prohibited content like adult/gambling/financial trading).
  2. NEW critical fraud signals from Stripe (account disabled, fraud verification errors, \
disputes/chargebacks at meaningful volume).
  3. Hard policy violations introduced AFTER the prior approval (new prohibited products).
- If the human's approval reason mentions special context (e.g., "hackathon participant", \
"trusted merchant", "use case is OK", "confirmed digital products only"), treat this as \
a binding decision and do NOT override it based on the same concerns.
- Re-flagging the same concerns wastes human reviewer time and degrades trust in the \
agent. When in doubt, defer to the prior human decision.

**Prior history (assess under IDENTITY_TRUST)**: The admin's other organizations \
on Polar (especially denied or blocked ones) are a meaningful risk signal here. \
Prior denials of OTHER orgs by the same admin are strong evidence — re-creating \
an organization after denial is grounds for denial.

Important information to check (assess under SETUP_READINESS):
- **Setup readiness check**: The org is ready to sell if ANY of these is true:
  1. At least one checkout link has benefits attached.
  2. API keys are configured AND checkout return URLs exist (programmatic integration).
  3. API keys are configured AND at least one webhook is enabled (working).
  If none of these conditions is met, it's a red flag — customers pay but receive nothing.
- **Domain consistency**: Checkout return URL domains and webhook domains should match \
the organization's website domain. If they don't match (and are not known service domains), \
this is a MEDIUM risk concern. Domains marked '(known service)' are legitimate third-party \
integration platforms and should NOT be flagged.
- **Redirect detection (CRITICAL)**: If any checkout success or return URL redirects to a \
different domain, this is a HIGH risk signal. Scammers use their own API endpoints that \
302-redirect users to prohibited content. Any cross-domain redirect is a strong red flag.

Known integration platform domains:
{known_domains_for_prompt()}

Return only APPROVE or DENY.
"""


MANUAL_PREAMBLE = f"""\
This is a MANUAL review triggered by a human reviewer from the backoffice. \
Perform a comprehensive analysis across ALL five dimensions with full detail, including SETUP_READINESS.

You have access to ALL available data: products, account info, identity verification, \
payment metrics (if any exist), prior history, and website content.

**Prior human approval trust**: If the "Prior Review Decisions" section shows a prior \
HUMAN approval, treat that as a strong trust signal. Do NOT re-raise concerns the human \
already considered (setup, integration, website, redirects, domain mismatches). Only flag \
NEW issues or NEW evidence that was not available at the prior review.

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
- **Prior history** (assess under IDENTITY_TRUST): Check for prior denials or blocked \
organizations. Re-creating an organization after denial is grounds for automatic denial.
- **Setup readiness** (assess under SETUP_READINESS):
  - **Setup readiness check**: The org is ready to sell if ANY of these is true:
    1. At least one checkout link has benefits attached.
    2. API keys are configured AND checkout return URLs exist (programmatic integration).
    3. API keys are configured AND at least one webhook is enabled (working).
    If none of these conditions is met, it's a red flag — customers pay but receive nothing.
  - **Domain consistency**: Checkout return URL domains and webhook domains should match \
the organization's website domain. If they don't match (and are not known service domains), \
this is a MEDIUM risk concern. Domains marked '(known service)' are legitimate third-party \
integration platforms and should NOT be flagged.
  - **Redirect detection (CRITICAL)**: If any checkout success or return URL redirects to a \
different domain, this is a HIGH risk signal. Scammers use their own API endpoints that \
302-redirect users to prohibited content. Any cross-domain redirect is a strong red flag.

Known integration platform domains:
{known_domains_for_prompt()}

Return only APPROVE or DENY.
"""


APPEAL_PREAMBLE = """\
This is an APPEAL review. The organization was previously DENIED at submission \
time and the merchant has now submitted an appeal explaining why they believe \
that decision was wrong. Their appeal text is included in the prompt under \
"## Appeal from Merchant".

Your decision here is FINAL — there is no further automated review after this. \
A merchant who is denied at this stage is told to contact human support if they \
disagree, but no Plain ticket is created automatically. So weigh the appeal \
text carefully.

How to evaluate the appeal:
- The "## Original Denial Message Shown to Merchant" section (if present) is \
the exact text the merchant read before writing their appeal. The appeal is \
their response to THAT specific message — read both side-by-side and judge \
whether the appeal directly addresses the stated concern.
- The "## Prior Review Decisions" section (further down) contains the prior \
agent's internal reasoning, which is more detailed than the merchant-facing \
text. Use it for richer context, but anchor your assessment on the concern \
the merchant was actually told about.
- Treat the appeal text as NEW evidence about the business that was not \
available at submission. The original review only saw the org's setup details \
and website; the appeal may clarify the actual product, customer base, or \
business model.
- If the appeal credibly explains away the original concern (e.g., "we sell \
Framer templates, not human consulting services"), and nothing else in the \
data contradicts it, APPROVE.
- If the appeal is vague, evasive, or does not address the original concern, \
DENY.
- If the appeal asserts something that directly contradicts hard data \
(prohibited products visible on Polar, Stripe fraud signals), DENY \
regardless of the appeal text. Do NOT use prior denied or blocked \
organizations as a signal at the appeal stage — judge this organization \
on its own merits and the appeal text.
- A short or generic appeal ("please approve me", "I disagree") with no \
specific information is grounds for DENY.

Assess only POLICY_COMPLIANCE, PRODUCT_LEGITIMACY, IDENTITY_TRUST. \
Skip FINANCIAL_RISK and SETUP_READINESS — set those to LOW with confidence 0.

Return only APPROVE or DENY, never NEEDS_HUMAN_REVIEW.

## Merchant-Facing Summary (merchant_summary)

Produce a short merchant_summary (1-2 sentences) shown directly to the merchant:
- For APPROVE: confirm that the appeal was accepted.
- For DENY: explain in general terms why the appeal was not sufficient and \
tell them to contact support if they believe the decision is wrong. NEVER \
mention scraped websites, prior organizations, risk scores, or specific \
fraud signals.

Examples for DENY:
- "Your appeal did not provide enough new information to overturn the original decision. If you believe this is wrong, please contact support."
- "Based on the information provided, we are unable to approve your organization. Please contact support if you believe this is incorrect."

Examples for APPROVE:
- "Your appeal has been accepted. Your organization has been approved to sell on Polar."
"""


def _annotate_domains(domains: list[str]) -> str:
    """Join domain names, tagging known service domains for the AI agent."""
    parts = []
    for d in domains:
        if match_known_domain(d) is not None:
            parts.append(f"{d} (known service)")
        else:
            parts.append(d)
    return ", ".join(parts)


class ReviewAnalyzer:
    def __init__(self, model: str | None = None) -> None:
        model_instance, model_provider, model_name = (
            settings.get_pydantic_gateway_model(model)
        )
        self.agent = Agent(
            model_instance,
            output_type=ReviewAgentReport,
            system_prompt=SYSTEM_PROMPT,
            model_settings={"temperature": 0},
        )
        self.model_provider = model_provider
        self.model_name = model_name

    async def analyze(
        self,
        snapshot: DataSnapshot,
        context: ReviewContext = ReviewContext.THRESHOLD,
        timeout_seconds: int = 60,
        policy_override: str | None = None,
    ) -> tuple[ReviewAgentReport, UsageInfo]:
        policy_content = policy_override or fetch_policy_content()

        prompt = self._build_prompt(snapshot, policy_content)

        instructions = {
            ReviewContext.SUBMISSION: SUBMISSION_PREAMBLE,
            ReviewContext.THRESHOLD: THRESHOLD_PREAMBLE,
            ReviewContext.MANUAL: MANUAL_PREAMBLE,
            ReviewContext.APPEAL: APPEAL_PREAMBLE,
        }.get(context)

        try:
            result = await asyncio.wait_for(
                self.agent.run(prompt, instructions=instructions),
                timeout=timeout_seconds,
            )
            usage = UsageInfo.from_agent_usage(
                result.usage(), self.model_provider, self.model_name
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
        identity = snapshot.identity
        payout_account = snapshot.account
        metrics = snapshot.metrics
        history = snapshot.history

        parts = []

        if snapshot.context == ReviewContext.APPEAL:
            if snapshot.original_denial_reason:
                parts.append("## Original Denial Message Shown to Merchant")
                parts.append(
                    "This is the exact text the merchant saw on their dashboard "
                    "and is now responding to:"
                )
                parts.append(snapshot.original_denial_reason)
                parts.append("")
            if snapshot.appeal_reason:
                parts.append("## Appeal from Merchant")
                parts.append(snapshot.appeal_reason)
                parts.append("")

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

            if products.custom_pricing_products_count > 0:
                parts.append(
                    f"Pay-what-you-want products (customer enters the amount): "
                    f"{products.custom_pricing_products_count} of {products.total_count}"
                )
            if products.adhoc_prices_count > 0:
                parts.append(
                    f"Ad-hoc prices created at checkout via the API "
                    f"(overriding the catalog price): {products.adhoc_prices_count}"
                )

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
                if setup.checkout_success_urls.redirect_results:
                    redirected = [
                        r
                        for r in setup.checkout_success_urls.redirect_results
                        if r.redirected
                    ]
                    if redirected:
                        parts.append(
                            "⚠️ SUCCESS URL REDIRECT DETECTED — these URLs redirect "
                            "to a DIFFERENT domain:"
                        )
                        for r in redirected:
                            parts.append(
                                f"  - {r.original_url} → REDIRECTS TO: "
                                f"{r.final_url} (domain: {r.final_domain})"
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
                if setup.checkout_return_urls.redirect_results:
                    redirected = [
                        r
                        for r in setup.checkout_return_urls.redirect_results
                        if r.redirected
                    ]
                    if redirected:
                        parts.append(
                            "⚠️ RETURN URL REDIRECT DETECTED — these URLs redirect "
                            "to a DIFFERENT domain:"
                        )
                        for r in redirected:
                            parts.append(
                                f"  - {r.original_url} → REDIRECTS TO: "
                                f"{r.final_url} (domain: {r.final_domain})"
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
            if setup.integration.webhook_endpoints:
                parts.append(f"Webhooks ({len(setup.integration.webhook_endpoints)}):")
                for ep in setup.integration.webhook_endpoints:
                    status = "enabled" if ep.enabled else "DISABLED"
                    parts.append(f"  - {ep.url} ({status})")
                parts.append(
                    f"Webhook Domains: {_annotate_domains(setup.integration.webhook_domains)}"
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
        parts.append("\n## Payout Account")
        parts.append(f"Account Type: {payout_account.type}")
        if payout_account.country:
            parts.append(f"Account Country: {payout_account.country}")
        if payout_account.business_type:
            parts.append(f"Business Type: {payout_account.business_type}")
        parts.append(f"Details Submitted: {payout_account.is_details_submitted}")
        parts.append(f"Charges Enabled: {payout_account.is_charges_enabled}")
        parts.append(f"Payouts Enabled: {payout_account.is_payouts_enabled}")
        if payout_account.business_name:
            parts.append(f"Business Name: {payout_account.business_name}")
        if payout_account.business_url:
            parts.append(f"Business URL: {payout_account.business_url}")
        if payout_account.business_support_address_country:
            parts.append(
                f"Support Address Country: {payout_account.business_support_address_country}"
            )
        if payout_account.capabilities:
            cap_strs = [f"{k}={v}" for k, v in payout_account.capabilities.items()]
            parts.append(f"Capabilities: {', '.join(cap_strs)}")
        if payout_account.requirements_disabled_reason:
            parts.append(
                f"WARNING — Disabled Reason: {payout_account.requirements_disabled_reason}"
            )
        if payout_account.requirements_errors:
            error_strs = [
                f"{e['code']}: {e['reason']}"
                for e in payout_account.requirements_errors
            ]
            parts.append(f"WARNING — Verification Errors: {'; '.join(error_strs)}")
        if payout_account.requirements_past_due:
            parts.append(
                f"Requirements Past Due: {', '.join(payout_account.requirements_past_due)}"
            )
        if payout_account.requirements_currently_due:
            parts.append(
                f"Requirements Currently Due: {', '.join(payout_account.requirements_currently_due)}"
            )
        if payout_account.requirements_pending_verification:
            parts.append(
                f"Requirements Pending Verification: {', '.join(payout_account.requirements_pending_verification)}"
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
                f"Refunded Orders: {metrics.refund_count} (${metrics.refund_amount_cents / 100:,.2f})"
            )
            if metrics.succeeded_payments > 0:
                refund_rate = metrics.refund_count / metrics.succeeded_payments * 100
                parts.append(f"Refund Rate: {refund_rate:.1f}%")
                if metrics.succeeded_payments < 10:
                    parts.append(
                        f"⚠️ LOW VOLUME ({metrics.succeeded_payments} payments) — "
                        "rate-based metrics are NOT statistically meaningful at this volume."
                    )
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
                if po.is_blocked:
                    flags.append("BLOCKED")
                flag_str = f" [{', '.join(flags)}]" if flags else ""
                parts.append(f"- {po.slug} (status={po.status}){flag_str}")
        else:
            parts.append("No other organizations for this user.")

        # Prior Review Decisions
        prior_feedback = snapshot.prior_feedback
        if prior_feedback.entries:
            human_approvals = [
                e
                for e in prior_feedback.entries
                if e.actor_type == ActorType.HUMAN
                and e.decision == DecisionType.APPROVE
            ]
            parts.append("\n## Prior Review Decisions")
            if human_approvals:
                parts.append(
                    f"⚠️ THIS ORGANIZATION HAS BEEN APPROVED BY A HUMAN REVIEWER "
                    f"{len(human_approvals)} TIME(S). This is a strong trust signal. "
                    "You should strongly default to APPROVE unless you find NEW evidence "
                    "of a clearly prohibited business or NEW critical fraud signals that "
                    "were NOT present in the prior reviews. Do NOT re-raise the same "
                    "concerns the human already considered (setup, integration, website, "
                    "redirects, domain mismatches, etc). Re-flagging resolved concerns "
                    "wastes reviewer time and degrades trust in the agent."
                )
            else:
                parts.append(
                    "The following previous review decisions exist for this "
                    "organization. Do NOT re-raise the same concerns unless you have "
                    "new, concrete evidence that was not available during the prior "
                    "review. Focus your analysis on what has CHANGED since the last "
                    "review."
                )
            for entry in prior_feedback.entries:
                date_str = (
                    entry.created_at.strftime("%Y-%m-%d")
                    if entry.created_at
                    else "unknown date"
                )
                parts.append(
                    f"\n### {entry.review_context.upper()} review ({date_str})"
                )
                parts.append(f"- Actor: {entry.actor_type}")
                parts.append(f"- Decision: {entry.decision}")
                if entry.agent_verdict:
                    parts.append(f"- Agent Verdict: {entry.agent_verdict}")
                if entry.agent_risk_level is not None:
                    parts.append(f"- Agent Risk Level: {entry.agent_risk_level}")
                if entry.agent_report_summary:
                    parts.append(f"- Agent Summary: {entry.agent_report_summary}")
                if entry.violated_sections:
                    parts.append(
                        f"- Violated Sections: {', '.join(entry.violated_sections)}"
                    )
                if entry.dimensions:
                    parts.append("- Dimension Assessments:")
                    for dim in entry.dimensions:
                        findings_str = (
                            f" — {'; '.join(dim.findings)}" if dim.findings else ""
                        )
                        parts.append(
                            f"  - {dim.dimension}: {dim.risk_level}{findings_str}"
                        )
                if entry.reason:
                    parts.append(f"- Reviewer Reason: {entry.reason}")

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


def _fallback_report(summary: str, finding: str, action: str) -> ReviewAgentReport:
    from .schemas import DimensionAssessment, ReviewDimension, ReviewVerdict, RiskLevel

    return ReviewAgentReport(
        verdict=ReviewVerdict.DENY,
        summary=summary,
        merchant_summary="Error occurred during analysis. Please contact support for assistance.",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                risk_level=RiskLevel.MEDIUM,
                confidence=0.0,
                findings=[finding],
                recommendation="Human review required",
            )
        ],
        overall_risk_level=RiskLevel.MEDIUM,
        recommended_action=action,
    )


def _timeout_report() -> ReviewAgentReport:
    return _fallback_report(
        "Analysis timed out. Denied for human review.",
        "Analysis timed out",
        "Human review required due to timeout.",
    )


def _error_report(error: str) -> ReviewAgentReport:
    msg = error[:200]
    return _fallback_report(
        f"Analysis failed with error: {msg}. Denied for human review.",
        f"Analysis error: {msg}",
        "Human review required due to analysis error.",
    )


# Module-level singleton
review_analyzer = ReviewAnalyzer()
