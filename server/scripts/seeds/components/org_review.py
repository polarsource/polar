"""Org review state seed component.

Sets the organization's review state. Unlike the other components it mutates the
org + the review row the runner created, rather than adding a child entity.
"""

from __future__ import annotations

from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models.organization import OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import SupportCaseAudience, SupportCaseMessageAuthorKind
from polar.organization_review.appeal_case import appeal_case as appeal_case_service
from polar.support_case.service import support_case as support_case_service

from scripts.seeds.base import SeedContext, Variant

APPEAL_REASON = "We are a legitimate SaaS business — please review our appeal."


class OrgReviewComponent:
    key = "org_review"
    label = "Org review state"
    default_on = False
    requires: list[str] = []
    variants = [
        Variant("active", "Active (approved)"),
        Variant("review", "Under review"),
        Variant("denied", "Denied + rejected appeal"),
    ]

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        variant = variant or "active"
        if variant == "active":
            return "org review: active"

        review = (
            await ctx.session.execute(
                select(OrganizationReview).where(
                    OrganizationReview.organization_id == ctx.organization.id,
                    OrganizationReview.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if variant == "review":
            ctx.organization.set_status(OrganizationStatus.REVIEW)
            ctx.session.add(ctx.organization)
            return "org review: under review"

        ctx.organization.set_status(OrganizationStatus.DENIED)
        ctx.session.add(ctx.organization)
        if review is None:
            return "org review: denied (no review row)"

        review.verdict = OrganizationReview.Verdict.FAIL
        review.risk_score = 88.0
        review.violated_sections = ["acceptable_use"]
        review.reason = "Automated review flagged the business for verification."
        review.appeal_submitted_at = utc_now()
        review.appeal_reason = APPEAL_REASON
        review.appeal_reviewed_at = utc_now()
        review.appeal_decision = OrganizationReview.AppealDecision.REJECTED
        ctx.session.add(review)
        await ctx.session.flush()

        if await appeal_case_service.get_case(ctx.session, review) is None:
            appeal_case = await appeal_case_service.request_human_review(
                ctx.session,
                review,
                organization=ctx.organization,
                reason=APPEAL_REASON,
                requested_by_user=ctx.owner,
            )
            await support_case_service.post_message(
                ctx.session,
                appeal_case,
                author_kind=SupportCaseMessageAuthorKind.platform,
                body="Thanks for reaching out. Could you share your website and what you sell?",
                audience=[SupportCaseAudience.merchant],
            )
            await support_case_service.post_message(
                ctx.session,
                appeal_case,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                author_user=ctx.owner,
                body="Sure — https://example.com. We sell developer tooling subscriptions.",
                audience=[SupportCaseAudience.merchant],
            )

        return "org review: denied + rejected appeal"


component = OrgReviewComponent()
