"""
Appeal Review Agent — autonomous AI agent that investigates organization appeals.

When organizations are denied on Polar, they can submit an appeal. This script
creates an AI agent that autonomously investigates the appeal using tools (DB
queries, Plain threads, website browsing) and produces a recommendation.

Usage:
    cd server

    # Basic usage
    uv run python -m scripts.appeal_review <org_slug>

    # With explicit Plain API key
    uv run python -m scripts.appeal_review <org_slug> --plain-api-key <key>

    # Override AI model
    uv run python -m scripts.appeal_review <org_slug> --model openai:gpt-4o

    # Skip optional data sources
    uv run python -m scripts.appeal_review <org_slug> --skip-website
    uv run python -m scripts.appeal_review <org_slug> --skip-plain
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any
from uuid import UUID

import httpx
import structlog
from pydantic import model_validator
from pydantic_ai import Agent, RunContext

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.schemas import Schema
from polar.models.organization import Organization
from polar.models.user_organization import UserOrganization
from polar.organization.repository import OrganizationRepository
from polar.organization_review.collectors.feedback import collect_feedback_data
from polar.organization_review.collectors.history import collect_history_data
from polar.organization_review.collectors.identity import collect_identity_data
from polar.organization_review.collectors.metrics import collect_metrics_data
from polar.organization_review.collectors.organization import collect_organization_data
from polar.organization_review.collectors.payout_account import (
    collect_payout_account_data,
)
from polar.organization_review.collectors.products import collect_products_data
from polar.organization_review.collectors.setup import collect_setup_data
from polar.organization_review.collectors.website import collect_website_data
from polar.organization_review.policy import fetch_policy_content
from polar.organization_review.report import parse_agent_report
from polar.organization_review.repository import OrganizationReviewRepository
from polar.postgres import create_async_engine

from .helper import configure_script_console_logging

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Output schemas
# ---------------------------------------------------------------------------


class AppealAction(StrEnum):
    APPROVE = "approve"
    DENY = "deny"
    FOLLOW_UP = "follow_up"


class AppealReviewResult(Schema):
    org_slug: str
    action: AppealAction
    reasoning: str
    draft_email: str

    @model_validator(mode="after")
    def _normalize_escaped_newlines(self) -> AppealReviewResult:
        """LLMs sometimes produce literal '\\n' instead of real newlines in
        structured output.  Replace them so Plain threads render correctly."""
        self.reasoning = self.reasoning.replace("\\n", "\n")
        self.draft_email = self.draft_email.replace("\\n", "\n")
        return self


# ---------------------------------------------------------------------------
# Agent dependencies
# ---------------------------------------------------------------------------


@dataclass
class AppealAgentDeps:
    sessionmaker: Any  # async_sessionmaker
    plain_client: Any | None  # Plain | None
    plain_token: str | None
    skip_website: bool
    org_slug: str
    # Cached after first lookup
    _organization: Organization | None = field(default=None, repr=False)
    _organization_id: UUID | None = field(default=None, repr=False)
    _admin_user_id: UUID | None = field(default=None, repr=False)
    _admin_email: str | None = field(default=None, repr=False)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an appeal reviewer for Polar, a Merchant of Record (MoR) platform for \
digital products. Organizations that were denied during their initial review can \
submit an appeal explaining why they believe the decision was incorrect.

Your job is to investigate the appeal thoroughly using the tools available to you, \
then produce a structured recommendation: approve, deny, or follow_up.

## Investigation Process

1. **Always start** by calling `get_organization` to load the org details.
2. **Always** call `get_appeal_info` to read the appeal reason and the AI review \
verdict that led to the denial.
3. **Always** call `get_review_history` to see the full chronological trail of \
review decisions.
4. Based on what you find, decide what else to investigate:
   - If the appeal claims the product is legitimate, check `get_products` and \
consider `browse_website` to verify.
   - If there are payment concerns, check `get_payment_metrics`.
   - If identity is in question, check `get_account_identity`.
   - If the user has prior organizations, check `get_user_history`.
   - If there's Plain conversation context, check `get_plain_threads` and \
`get_thread_messages`.
   - If you need to verify a claim about the website, use `browse_website`.
   - Call `get_acceptable_use_policy` if you need to check specific policy sections.
   - Call `get_setup_signals` if you want to see checkout URLs, API keys, webhooks.

## Appeal Consideration

**The merchant's appeal is a critical piece of evidence.** Do not dismiss it. Read it \
carefully and give it real weight in your decision. The appeal represents the merchant's \
own explanation of their business, and many denials are false positives from automated \
review. Cross-reference their claims with the data, but start from a position of \
good faith.

## Common False Positives in Appeals

The initial automated review over-flags certain patterns. Watch for these:
- **Developer tools flagged as "circumvention"** — wrapping a third-party API \
(e.g. WhatsApp Business API, Telegram Bot API) is not circumventing it. SDKs, \
API clients, and developer platforms built on top of official APIs are legitimate \
products, not policy violations.
- **Messaging platforms flagged as "spam tools"** — CRM tools, helpdesk software, \
and customer communication platforms that use messaging APIs are not spam tools. \
Sending messages on behalf of a business's own customers ≠ unsolicited bulk messaging.
- **Automation tools flagged as "marketing automation"** — workflow automation, \
chatbot builders, and no-code platforms are general-purpose tools, not outreach \
spam. The fact that a tool COULD be used for marketing does not make it a \
marketing automation product.
- **"Unlimited" plans flagged as bulk messaging risk** — "unlimited" is a standard \
SaaS pricing tier (like "unlimited projects" or "unlimited API calls"). It describes \
the merchant's pricing model, not message volume or spam capability.
- **API wrappers flagged as "not a real product"** — SDKs, API clients, middleware, \
and developer infrastructure are legitimate digital products. A product that makes \
another API easier to use is still a real product.

When you see these patterns in the initial denial reason, treat them as yellow flags \
on the DENIAL, not on the merchant.

## Human Services & Service-Based Businesses

When the product involves **human services** (consulting, coaching, freelance work, \
agency services, done-for-you services, managed services, tutoring, mentoring, etc.):
- These are **generally prohibited** on Polar, which is designed for digital products.
- **However**, if the merchant's appeal claims their product is actually automated or \
digital (e.g. "it looks like consulting but it's really an automated tool/SaaS/course"), \
do NOT immediately deny. Instead, **request a video demo** (FOLLOW_UP) so they can \
prove it. Ask for a short screen recording or Loom video showing the actual product \
experience and that it is indeed automated/digital.
- If the merchant does not claim automation and the product is clearly a human service, \
deny it.

## Decision Framework

### APPROVE when:
- The merchant provides a reasonable explanation that addresses the denial reason
- The denial was based on a misunderstanding or false positive
- The product/service is actually compliant with the AUP
- The merchant has made changes to come into compliance
- **The merchant expresses willingness to make significant changes** to come into \
compliance (e.g. removing prohibited products, changing their business model). Give \
them the benefit of the doubt — but still ask for a video demo of the app to confirm.

### DENY when:
- The product/service clearly and unambiguously violates the AUP even after \
considering the appeal
- There is evidence of fraud, deception, or re-creation after prior denial
- The merchant's claims directly contradict what you find in the data
- **DENY is reserved for confident, unambiguous violations** — not "potential" \
concerns or "could be interpreted as" situations. If you find yourself hedging, \
that's a FOLLOW_UP.
- **Do NOT deny based on what a tool COULD theoretically be used for** — deny \
based on what it IS. A kitchen knife can be a weapon; that doesn't make it one.
- **Do NOT deny when the merchant's appeal provides a plausible explanation** that \
you haven't been able to disprove — use FOLLOW_UP instead.

### FOLLOW_UP when:
- The appeal is plausible but you need more information from the merchant
- The situation is ambiguous and a human should ask specific questions
- The merchant partially addresses concerns but leaves key questions unanswered
- **The business involves human services** — always ask for a video demo showing \
how the service works and what the customer receives after purchase.
- **When in doubt, ask for a video demo** — request a short screen recording or Loom \
video showing how the app/product works. This is one of the most effective ways to \
verify legitimacy for borderline cases. Always prefer FOLLOW_UP with a video request \
over a hard DENY when the case is borderline.
- **You are a second pair of eyes, not a rubber stamp.** Your job is to catch \
false positives from the initial review. When the initial review and the appeal \
present conflicting signals, default to FOLLOW_UP — let a human make the final call.
- **If you find yourself weighing "on one hand / on the other hand" arguments**, \
that IS a FOLLOW_UP case. The uncertainty itself is the signal.

## Calibration: Developer Tools, APIs, and Middleware

When evaluating developer infrastructure products, apply these principles:

1. **Wrapping a third-party API is a legitimate product category.** SDKs, API \
clients, middleware layers, and developer platforms that sit on top of services \
like WhatsApp Business API, Stripe, Twilio, etc. are real digital products with \
real value. This is a well-established software category.
2. **The upstream API's terms are the upstream API's concern, not Polar's.** If a \
developer builds a WhatsApp API wrapper and WhatsApp allows it, Polar should not \
second-guess WhatsApp's own terms of service. Polar's AUP covers what Polar \
prohibits, not what upstream providers might theoretically restrict.
3. **"Unlimited" is a pricing tier, not a risk signal.** SaaS products commonly \
offer unlimited plans (unlimited projects, unlimited API calls, unlimited messages). \
This is standard pricing, not evidence of spam or abuse capability.
4. **Potential for misuse ≠ prohibited tool.** Almost any communication tool can \
theoretically be misused. Email clients, SMS APIs, and messaging platforms are not \
spam tools merely because spam exists. Evaluate the product's intended use, not \
hypothetical worst-case scenarios.
5. **Developer platforms are digital products.** IaaS, PaaS, middleware, and \
developer tooling are squarely within Polar's target market of digital products \
for developers.

## Currently Allowed Categories (Edge Cases)

These categories have been explicitly approved by the Polar team despite potentially \
triggering policy flags:
- **Messaging API platforms and middleware** — WhatsApp Business API wrappers, \
Telegram Bot API platforms, SMS API middleware, and other developer infrastructure \
that makes messaging APIs easier to use. These are legitimate developer tools, not \
spam services. Examples: WhatsApp CRM integrations, chatbot hosting platforms, \
multi-channel messaging SDKs.
- **Developer tooling and API infrastructure** — SDKs, API wrappers, developer \
platforms, and middleware built on top of third-party APIs. A product that simplifies \
or extends another API is a legitimate digital product.
- **Automation and workflow platforms** — chatbot builders, CRM automation tools, \
no-code workflow platforms, and integration tools. General-purpose automation is a \
legitimate product category.
- **WhatsApp AI assistant hosting** (e.g. OpenClaws, NanoClaw) — SaaS that provisions \
and manages AI chatbot containers on WhatsApp. These are legitimate hosted SaaS products, \
not telecom services or spam tools. Approve unless there are other concrete red flags.

## Email Style Guide

Write emails that are:
- Professional and empathetic — remember these are real people whose business is affected
- Direct — state the decision clearly upfront
- Specific — reference what they said in their appeal and what you found
- Actionable — if following up, ask specific questions; if denying, explain why clearly

### Example: Follow-up email
Subject context: Merchant claims they sell digital templates but website shows consulting.

"Hi,

Thanks for your appeal and for taking the time to explain your business.

We reviewed your account and can see you've listed digital template products on Polar. \
However, we noticed your website primarily describes consulting and agency services, \
which fall under our restricted categories.

Could you help us understand:
1. Are the templates sold on Polar separate from your consulting business?
2. Do customers receive the templates immediately after purchase (digital delivery)?
3. Could you share a short video (e.g. a Loom recording) showing how the product works \
and what a customer receives after purchase?

Once we have this information, we'll be able to complete our review.

Best,
The Polar Team"

### Example: Denial email
"Hi,

Thank you for submitting your appeal. We've carefully reviewed your account and the \
information you provided.

Unfortunately, we're unable to approve your organization at this time. Your product \
falls under [specific policy section], which is not permitted on our platform.

If you believe this assessment is incorrect or if your business model has changed, \
you're welcome to reach out to our support team with additional details.

Best,
The Polar Team"

### Example: Approval email
"Hi,

Thanks for your appeal. We've reviewed your account and the additional context you \
provided.

We're happy to let you know that your organization has been approved! You can now \
start accepting payments on Polar.

If you have any questions about getting set up, don't hesitate to reach out.

Best,
The Polar Team"

## Appeal Calibration Examples

### Example A: Developer platform denied as "spam tool" → APPROVE

**Initial denial reason:** "Product enables bulk WhatsApp messaging and may \
circumvent WhatsApp's terms of service. Classified as spam/messaging tool."

**Appeal:** "We are a developer platform that provides APIs and SDKs for \
businesses to integrate WhatsApp Business API into their own applications. We \
use the official WhatsApp Business API and our customers are verified businesses."

**Correct decision: APPROVE.** The initial review confused "uses WhatsApp API" \
with "circumvents WhatsApp." The product wraps an official API — this is a \
standard developer tool. The "bulk messaging" flag was triggered by an "unlimited" \
pricing tier, which is just a SaaS pricing model. There is no evidence of actual \
spam, TOS circumvention, or prohibited activity.

### Example B: Automation tool denied as "marketing automation" → FOLLOW_UP

**Initial denial reason:** "Product appears to be a marketing automation platform \
for automated outreach campaigns."

**Appeal:** "We build workflow automation for small businesses. Our tool connects \
various services and automates repetitive tasks. Some customers use it for \
customer outreach, but it's a general-purpose automation tool."

**Correct decision: FOLLOW_UP.** The appeal is plausible — general-purpose \
automation is allowed. However, the merchant acknowledges some outreach use, \
and the initial review flagged marketing automation specifically. Ask for a \
video demo showing typical use cases, and ask the merchant to clarify what \
percentage of usage is outreach vs. other automation. The signals are genuinely \
mixed; let a human decide.

## Important Constraints

- You can only READ data. You cannot make any changes.
- Always check the AUP before making a policy compliance judgment.
- Cross-reference the merchant's claims with actual data — don't take the appeal \
at face value.
- Be fair. Some denials are false positives. Give merchants the benefit of the doubt \
when their explanation is reasonable and consistent with the data.
"""


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------


def _create_agent(model_name: str) -> Agent[AppealAgentDeps, AppealReviewResult]:
    model_instance, _, _ = settings.get_pydantic_gateway_model(model_name)
    agent: Agent[AppealAgentDeps, AppealReviewResult] = Agent(
        model_instance,
        output_type=AppealReviewResult,
        deps_type=AppealAgentDeps,
        system_prompt=SYSTEM_PROMPT,
        retries=1,
    )

    # ------------------------------------------------------------------
    # Tool: get_organization
    # ------------------------------------------------------------------

    @agent.tool
    async def get_organization(ctx: RunContext[AppealAgentDeps]) -> str:
        """Load organization details: name, website, email, socials, about,
        product description, intended use, and status."""
        deps = ctx.deps
        async with deps.sessionmaker() as session:
            org_repo = OrganizationRepository.from_session(session)
            org = await org_repo.get_by_slug(deps.org_slug)
            if org is None:
                return f"Error: Organization '{deps.org_slug}' not found."

            deps._organization = org
            deps._organization_id = org.id

            # Find admin user
            admin = await org_repo.get_admin_user(org)
            if admin:
                deps._admin_user_id = admin.id
                deps._admin_email = admin.email

            org_data = collect_organization_data(org)
            parts = [
                f"Name: {org_data.name}",
                f"Slug: {org_data.slug}",
                f"Status: {org.status.value}",
                f"Website: {org_data.website or 'not set'}",
                f"Email: {org_data.email or 'not set'}",
                f"About: {org_data.about or 'not provided'}",
                f"Product Description: {org_data.product_description or 'not provided'}",
                f"Switching From: {org_data.switching_from or 'not provided'}",
            ]
            if org_data.socials:
                socials_str = ", ".join(
                    f"{s['platform']}: {s['url']}" for s in org_data.socials
                )
                parts.append(f"Social Links: {socials_str}")
            else:
                parts.append("Social Links: none")
            if org_data.created_at:
                parts.append(f"Created: {org_data.created_at.strftime('%Y-%m-%d')}")
            if org_data.is_blocked:
                parts.append("BLOCKED")

            log.info("tool.get_organization", slug=deps.org_slug)
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_appeal_info
    # ------------------------------------------------------------------

    @agent.tool
    async def get_appeal_info(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get the appeal reason, submission date, current AI review verdict/reason,
        and appeal status."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            from polar.organization.repository import (
                OrganizationReviewRepository as OrgReviewRepo,
            )

            review_repo = OrgReviewRepo.from_session(session)
            review = await review_repo.get_by_organization(deps._organization_id)

            if review is None:
                return "No review record found for this organization."

            parts = [
                f"AI Review Verdict: {review.verdict}",
                f"AI Review Reason: {review.reason}",
                f"Risk Score: {review.risk_score}",
                f"Model Used: {review.model_used}",
                f"Reviewed At: {review.validated_at.strftime('%Y-%m-%d %H:%M')}",
            ]

            if review.violated_sections:
                parts.append(
                    f"Violated Sections: {', '.join(review.violated_sections)}"
                )

            if review.appeal_submitted_at:
                parts.append(
                    f"Appeal Submitted: {review.appeal_submitted_at.strftime('%Y-%m-%d %H:%M')}"
                )
                parts.append(f"Appeal Reason: {review.appeal_reason or 'not provided'}")
            else:
                parts.append("No appeal has been submitted.")

            if review.appeal_decision:
                parts.append(f"Appeal Decision: {review.appeal_decision}")
                if review.appeal_reviewed_at:
                    parts.append(
                        f"Appeal Reviewed At: {review.appeal_reviewed_at.strftime('%Y-%m-%d %H:%M')}"
                    )

            # Also get latest agent review for richer data
            agent_review_repo = OrganizationReviewRepository.from_session(session)
            latest_agent = await agent_review_repo.get_latest_agent_review(
                deps._organization_id
            )
            if latest_agent:
                try:
                    parsed = parse_agent_report(latest_agent.report)
                    report = parsed.report
                    parts.append("\nLatest Agent Review (detailed):")
                    parts.append(f"  Verdict: {report.verdict}")
                    parts.append(f"  Summary: {report.summary}")
                    parts.append(f"  Overall Risk: {report.overall_risk_level}")
                    if report.violated_sections:
                        parts.append(
                            f"  Violated: {', '.join(report.violated_sections)}"
                        )
                    for dim in report.dimensions:
                        findings = "; ".join(dim.findings) if dim.findings else "none"
                        parts.append(
                            f"  {dim.dimension}: {dim.risk_level} (confidence={dim.confidence}) — {findings}"
                        )
                except Exception:
                    parts.append("  (Could not parse latest agent review report)")

            log.info("tool.get_appeal_info", org_id=str(deps._organization_id))
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_products
    # ------------------------------------------------------------------

    @agent.tool
    async def get_products(ctx: RunContext[AppealAgentDeps]) -> str:
        """List all products with their prices, billing types, and visibility."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            repo = OrganizationReviewRepository.from_session(session)
            products = await repo.get_products_with_prices(deps._organization_id)
            products_data = collect_products_data(products)

            if products_data.total_count == 0:
                return "No products created."

            parts = [f"Total products: {products_data.total_count}"]
            for p in products_data.products[:20]:
                status = "archived" if p.is_archived else (p.visibility or "unknown")
                parts.append(f"\n- {p.name} ({p.billing_type}, {status})")
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

            log.info("tool.get_products", count=products_data.total_count)
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_payment_metrics
    # ------------------------------------------------------------------

    @agent.tool
    async def get_payment_metrics(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get payment statistics: totals, risk scores, refund/dispute rates."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            repo = OrganizationReviewRepository.from_session(session)
            total, succeeded, amount = await repo.get_payment_stats(
                deps._organization_id
            )
            p50, p90 = await repo.get_risk_score_percentiles(deps._organization_id)
            refund_count, refund_amount = await repo.get_refund_stats(
                deps._organization_id
            )
            dispute_count, dispute_amount = await repo.get_dispute_stats(
                deps._organization_id
            )

            metrics = collect_metrics_data(
                total_payments=total,
                succeeded_payments=succeeded,
                total_amount_cents=amount,
                p50_risk_score=p50,
                p90_risk_score=p90,
                refund_count=refund_count,
                refund_amount_cents=refund_amount,
                dispute_count=dispute_count,
                dispute_amount_cents=dispute_amount,
            )

            if metrics.total_payments == 0:
                return "No payment history (new organization)."

            parts = [
                f"Total Payments: {metrics.total_payments}",
                f"Succeeded: {metrics.succeeded_payments}",
                f"Total Amount: ${metrics.total_amount_cents / 100:,.2f}",
            ]
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

            log.info("tool.get_payment_metrics", total=metrics.total_payments)
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_user_history
    # ------------------------------------------------------------------

    @agent.tool
    async def get_user_history(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get admin user info, other organizations, prior denials/blocks."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            repo = OrganizationReviewRepository.from_session(session)

            # Find admin user via UserOrganization
            from sqlalchemy import select

            stmt = select(UserOrganization.user_id).where(
                UserOrganization.organization_id == deps._organization_id,
                UserOrganization.is_deleted.is_(False),
            )
            result = await session.execute(stmt)
            user_ids = [row[0] for row in result.all()]

            if not user_ids:
                return "No users associated with this organization."

            user = await repo.get_user_by_id(user_ids[0])
            other_orgs = await repo.get_other_organizations_for_user(
                user_ids[0], deps._organization_id
            )
            history = collect_history_data(user, other_orgs)

            parts = [f"Admin Email: {history.user_email or 'unknown'}"]
            if history.user_blocked_at:
                parts.append("WARNING: User account is BLOCKED")
            if history.has_prior_denials:
                parts.append("WARNING: User has DENIED organizations")
            if history.has_blocked_orgs:
                parts.append("WARNING: User has BLOCKED organizations")

            if history.prior_organizations:
                parts.append(
                    f"\nOther organizations ({len(history.prior_organizations)}):"
                )
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

            log.info("tool.get_user_history", user_email=history.user_email)
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_account_identity
    # ------------------------------------------------------------------

    @agent.tool
    async def get_account_identity(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get Stripe account details and identity verification status."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            # Get org with account
            org_repo = OrganizationRepository.from_session(session)
            org = await org_repo.get_by_id_with_payout_account(deps._organization_id)
            if org is None:
                return "Organization not found."

            payout_account = org.payout_account
            payout_account_data = collect_payout_account_data(payout_account)
            identity_data = await collect_identity_data(
                payout_account.admin if payout_account else None
            )

            parts = ["## Payout Account"]
            parts.append(f"Type: {payout_account_data.type or 'unknown'}")
            parts.append(f"Country: {payout_account_data.country or 'unknown'}")
            parts.append(
                f"Business Type: {payout_account_data.business_type or 'unknown'}"
            )
            parts.append(
                f"Details Submitted: {payout_account_data.is_details_submitted}"
            )
            parts.append(f"Charges Enabled: {payout_account_data.is_charges_enabled}")
            parts.append(f"Payouts Enabled: {payout_account_data.is_payouts_enabled}")
            if payout_account_data.business_name:
                parts.append(f"Business Name: {payout_account_data.business_name}")
            if payout_account_data.business_url:
                parts.append(f"Business URL: {payout_account_data.business_url}")
            if payout_account_data.requirements_disabled_reason:
                parts.append(
                    f"WARNING — Disabled Reason: {payout_account_data.requirements_disabled_reason}"
                )
            if payout_account_data.requirements_errors:
                error_strs = [
                    f"{e['code']}: {e['reason']}"
                    for e in payout_account_data.requirements_errors
                ]
                parts.append(f"WARNING — Errors: {'; '.join(error_strs)}")

            parts.append("\n## Identity Verification")
            parts.append(f"Status: {identity_data.verification_status or 'unknown'}")
            if identity_data.verification_error_code:
                parts.append(f"Error: {identity_data.verification_error_code}")
            if identity_data.verified_first_name or identity_data.verified_last_name:
                parts.append(
                    f"Verified Name: {identity_data.verified_first_name or ''} {identity_data.verified_last_name or ''}".strip()
                )
            if identity_data.verified_address_country:
                parts.append(
                    f"Verified Country: {identity_data.verified_address_country}"
                )

            log.info("tool.get_account_identity")
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_review_history
    # ------------------------------------------------------------------

    @agent.tool
    async def get_review_history(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get the full chronological trail of all review decisions (agent + human)."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            repo = OrganizationReviewRepository.from_session(session)
            records = await repo.get_feedback_history(deps._organization_id)
            feedback_data = collect_feedback_data(records)

            if not feedback_data.entries:
                return "No review history found."

            parts = [f"Review history ({len(feedback_data.entries)} entries):"]
            for entry in feedback_data.entries:
                date_str = (
                    entry.created_at.strftime("%Y-%m-%d %H:%M")
                    if entry.created_at
                    else "unknown"
                )
                parts.append(f"\n### {entry.review_context.upper()} ({date_str})")
                parts.append(f"  Actor: {entry.actor_type}")
                parts.append(f"  Decision: {entry.decision}")
                if entry.agent_verdict:
                    parts.append(f"  Agent Verdict: {entry.agent_verdict}")
                if entry.agent_risk_level:
                    parts.append(f"  Risk Level: {entry.agent_risk_level}")
                if entry.agent_report_summary:
                    parts.append(f"  Summary: {entry.agent_report_summary}")
                if entry.violated_sections:
                    parts.append(f"  Violated: {', '.join(entry.violated_sections)}")
                if entry.dimensions:
                    for dim in entry.dimensions:
                        findings = "; ".join(dim.findings) if dim.findings else "none"
                        parts.append(
                            f"  {dim.dimension}: {dim.risk_level} — {findings}"
                        )
                if entry.reason:
                    parts.append(f"  Human Reason: {entry.reason}")

            log.info("tool.get_review_history", count=len(feedback_data.entries))
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_setup_signals
    # ------------------------------------------------------------------

    @agent.tool
    async def get_setup_signals(ctx: RunContext[AppealAgentDeps]) -> str:
        """Get checkout URLs, API keys, webhooks, and integration signals."""
        deps = ctx.deps
        if deps._organization_id is None:
            return "Error: Call get_organization first."

        async with deps.sessionmaker() as session:
            repo = OrganizationReviewRepository.from_session(session)
            checkout_links = await repo.get_checkout_links_with_benefits(
                deps._organization_id
            )
            checkout_return_urls = await repo.get_checkout_return_urls(
                deps._organization_id
            )
            checkout_success_urls = await repo.get_checkout_success_urls(
                deps._organization_id
            )
            api_key_count = await repo.get_api_key_count(deps._organization_id)
            webhook_endpoints = await repo.get_webhook_endpoints(deps._organization_id)

            setup = collect_setup_data(
                checkout_links,
                checkout_return_urls,
                checkout_success_urls,
                api_key_count,
                webhook_endpoints,
            )

            parts = []
            if setup.checkout_success_urls.unique_urls:
                parts.append(
                    f"Checkout Success URLs: {', '.join(setup.checkout_success_urls.unique_urls)}"
                )
            else:
                parts.append("No custom checkout success URLs.")

            if setup.checkout_return_urls.unique_urls:
                parts.append(
                    f"Checkout Return URLs: {', '.join(setup.checkout_return_urls.unique_urls)}"
                )
            else:
                parts.append("No custom checkout return URLs.")

            parts.append(f"API Keys: {setup.integration.api_key_count}")
            if setup.integration.webhook_endpoints:
                webhook_strs = [
                    f"{ep.url} ({'enabled' if ep.enabled else 'DISABLED'})"
                    for ep in setup.integration.webhook_endpoints
                ]
                parts.append(f"Webhooks: {', '.join(webhook_strs)}")
            else:
                parts.append("No webhook endpoints.")

            if setup.checkout_links.total_links > 0:
                parts.append(
                    f"Checkout Links: {setup.checkout_links.total_links} total, "
                    f"{setup.checkout_links.links_without_benefits} without benefits"
                )

            log.info("tool.get_setup_signals")
            return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_plain_threads
    # ------------------------------------------------------------------

    @agent.tool
    async def get_plain_threads(ctx: RunContext[AppealAgentDeps]) -> str:
        """List all Plain support threads for this org's admin user."""
        deps = ctx.deps
        if deps.plain_client is None:
            return "Plain integration is not available (skipped or no token)."
        if deps._admin_email is None:
            return "Error: No admin email found. Call get_organization first."

        from plain_client import ThreadsFilter, ThreadStatus

        plain = deps.plain_client

        # Find customer by email
        customer = await plain.customer_by_email(email=deps._admin_email)
        if not customer:
            return f"No Plain customer found for {deps._admin_email}."

        # Get all non-done threads
        filters = ThreadsFilter(
            customer_ids=[customer.id],
            statuses=[ThreadStatus.TODO, ThreadStatus.SNOOZED, ThreadStatus.DONE],
        )
        result = await plain.threads(filters=filters, first=50)

        if not result.edges:
            return "No Plain threads found for this user."

        parts = [f"Found {len(result.edges)} thread(s):"]
        for edge in result.edges:
            thread = edge.node
            created = ""
            if hasattr(thread, "created_at") and thread.created_at:
                created = f" (created: {thread.created_at})"
            parts.append(
                f"- [{thread.status.value}] {thread.title} (id: {thread.id}){created}"
            )
            if thread.preview_text:
                parts.append(f"  Preview: {thread.preview_text[:200]}")

        log.info("tool.get_plain_threads", count=len(result.edges))
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_thread_messages
    # ------------------------------------------------------------------

    @agent.tool
    async def get_thread_messages(
        ctx: RunContext[AppealAgentDeps], thread_id: str
    ) -> str:
        """Read the conversation messages in a specific Plain thread.
        Pass the thread_id from get_plain_threads."""
        deps = ctx.deps
        if deps.plain_token is None:
            return "Plain integration is not available."

        # Use raw GraphQL to get timeline entries
        query = """
        query ThreadTimeline($threadId: ID!) {
          thread(threadId: $threadId) {
            title
            timelineEntries(first: 50) {
              edges {
                node {
                  actor {
                    __typename
                    ... on UserActor {
                      user { fullName }
                    }
                    ... on CustomerActor {
                      customer { fullName email { email } }
                    }
                  }
                  entry {
                    ... on ChatEntry {
                      text
                    }
                    ... on EmailEntry {
                      textContent
                      from { name email }
                      to { name email }
                    }
                  }
                }
              }
            }
          }
        }
        """

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://core-api.uk.plain.com/graphql/v1",
                headers={
                    "Authorization": f"Bearer {deps.plain_token}",
                    "Content-Type": "application/json",
                },
                json={"query": query, "variables": {"threadId": thread_id}},
                timeout=15.0,
            )

        if response.status_code != 200:
            return f"Error fetching thread: HTTP {response.status_code}"

        data = response.json()
        thread_data = data.get("data", {}).get("thread")
        if not thread_data:
            return f"Thread {thread_id} not found."

        parts = [f"Thread: {thread_data.get('title', 'Untitled')}"]

        entries = thread_data.get("timelineEntries", {}).get("edges", [])
        if not entries:
            parts.append("No messages in this thread.")
        else:
            for edge in entries:
                node = edge.get("node", {})
                entry = node.get("entry", {})
                text = entry.get("text") or entry.get("textContent") or ""
                if not text:
                    continue

                # Determine sender from the actor on the timeline entry
                actor = node.get("actor", {})
                actor_type = actor.get("__typename", "")
                sender = "Unknown"
                if actor_type == "CustomerActor":
                    cust = actor.get("customer", {})
                    sender = cust.get("fullName") or "Customer"
                elif actor_type == "UserActor":
                    user = actor.get("user", {})
                    sender = user.get("fullName") or "Agent"
                elif entry.get("from"):
                    sender = entry["from"].get("name") or entry["from"].get("email", "")

                parts.append(f"\n[{sender}]: {text[:1000]}")

        log.info("tool.get_thread_messages", thread_id=thread_id)
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: browse_website
    # ------------------------------------------------------------------

    @agent.tool
    async def browse_website(ctx: RunContext[AppealAgentDeps], url: str) -> str:
        """Scrape and summarize a website URL. Use this to verify merchant claims
        about their product or business."""
        deps = ctx.deps
        if deps.skip_website:
            return "Website browsing is disabled (--skip-website)."

        log.info("tool.browse_website", url=url)
        website_data = await collect_website_data(url)

        parts = [f"URL: {website_data.base_url}"]
        if website_data.scrape_error:
            parts.append(f"Error: {website_data.scrape_error}")
        if website_data.summary:
            parts.append(f"\nSummary:\n{website_data.summary}")
        parts.append(
            f"Pages scraped: {website_data.total_pages_succeeded}/{website_data.total_pages_attempted}"
        )

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Tool: get_acceptable_use_policy
    # ------------------------------------------------------------------

    @agent.tool
    async def get_acceptable_use_policy(ctx: RunContext[AppealAgentDeps]) -> str:
        """Fetch the current Polar Acceptable Use Policy text."""
        log.info("tool.get_acceptable_use_policy")
        return fetch_policy_content()

    return agent


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------


def _print_result(result: AppealReviewResult) -> None:
    print("\n" + "=" * 40)
    print(f"APPEAL REVIEW: {result.org_slug}")
    print("=" * 40)
    print(f"\nAction: {result.action}")
    print(f"\nReasoning:\n{result.reasoning}")
    print(f"\nDraft Email:\n---\n{result.draft_email}\n---")


async def run_appeal_review_with_deps(
    org_slug: str,
    *,
    session_maker: Any,
    plain_client: Any | None,
    plain_token: str | None,
    model: str = "openai:gpt-5.2-2025-12-11",
    skip_website: bool = False,
) -> AppealReviewResult:
    """Run the appeal review agent with pre-created dependencies.

    This allows callers (e.g. bulk processing scripts) to share a single
    DB engine and Plain client across multiple reviews.
    """
    deps = AppealAgentDeps(
        sessionmaker=session_maker,
        plain_client=plain_client,
        plain_token=plain_token,
        skip_website=skip_website,
        org_slug=org_slug,
    )

    agent = _create_agent(model)

    run_result = await agent.run(
        f"Review the appeal for organization: {org_slug}",
        deps=deps,
    )
    output = run_result.output
    _print_result(output)
    return output


async def run_appeal_review(
    org_slug: str,
    *,
    model: str = "openai:gpt-5.2-2025-12-11",
    plain_api_key: str | None = None,
    skip_website: bool = False,
    skip_plain: bool = False,
    interactive: bool = False,
) -> AppealReviewResult:
    engine = create_async_engine("script")
    session_maker = create_async_sessionmaker(engine)

    plain_token = plain_api_key or settings.PLAIN_TOKEN
    plain_client = None

    try:
        # Set up Plain client if available
        http_client = None
        if not skip_plain and plain_token:
            from plain_client import Plain

            http_client = httpx.AsyncClient(
                headers={"Authorization": f"Bearer {plain_token}"},
            )
            plain_client = Plain(
                "https://core-api.uk.plain.com/graphql/v1",
                http_client=http_client,
            )
            await plain_client.__aenter__()

        effective_plain_token = plain_token if not skip_plain else None

        if not interactive:
            return await run_appeal_review_with_deps(
                org_slug,
                session_maker=session_maker,
                plain_client=plain_client,
                plain_token=effective_plain_token,
                model=model,
                skip_website=skip_website,
            )

        # Interactive mode: run agent directly to keep message_history
        deps = AppealAgentDeps(
            sessionmaker=session_maker,
            plain_client=plain_client,
            plain_token=effective_plain_token,
            skip_website=skip_website,
            org_slug=org_slug,
        )
        agent = _create_agent(model)

        run_result = await agent.run(
            f"Review the appeal for organization: {org_slug}",
            deps=deps,
        )
        output = run_result.output
        _print_result(output)

        print(
            "\n--- Interactive mode. Type your comments to refine the review. "
            "Press Ctrl+C or type 'quit' to exit. ---\n"
        )
        message_history = run_result.all_messages()

        while True:
            try:
                user_input = input("You> ").strip()
            except EOFError:
                break
            if not user_input or user_input.lower() in ("quit", "exit", "q"):
                break

            run_result = await agent.run(
                user_input,
                deps=deps,
                message_history=message_history,
            )
            output = run_result.output
            message_history = run_result.all_messages()
            _print_result(output)

        return output

    finally:
        if plain_client is not None:
            await plain_client.__aexit__(None, None, None)
        if http_client is not None:
            await http_client.aclose()
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AI agent that reviews organization appeal requests"
    )
    parser.add_argument("org_slug", help="Organization slug to review")
    parser.add_argument(
        "--plain-api-key",
        default=None,
        help="Plain API key (overrides settings.PLAIN_TOKEN)",
    )
    parser.add_argument(
        "--model",
        default="openai:gpt-4o",
        help="OpenAI model to use (default: openai:gpt-4o)",
    )
    parser.add_argument(
        "--skip-website",
        action="store_true",
        help="Skip website browsing",
    )
    parser.add_argument(
        "--skip-plain",
        action="store_true",
        help="Skip Plain thread lookups",
    )
    parser.add_argument(
        "--no-interactive",
        action="store_true",
        help="Disable interactive mode (exit after initial review instead of chatting)",
    )
    args = parser.parse_args()

    configure_script_console_logging()

    try:
        asyncio.run(
            run_appeal_review(
                args.org_slug,
                model=args.model,
                plain_api_key=args.plain_api_key,
                skip_website=args.skip_website,
                skip_plain=args.skip_plain,
                interactive=not args.no_interactive,
            )
        )
    except KeyboardInterrupt:
        log.info("Interrupted by user")
        sys.exit(1)
    except Exception as e:
        log.error(
            "Script failed",
            error_type=type(e).__name__,
            error_message=str(e),
            exc_info=True,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
