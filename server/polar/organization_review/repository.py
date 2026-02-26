from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository.base import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models.account import Account
from polar.models.checkout import Checkout
from polar.models.checkout_link import CheckoutLink
from polar.models.checkout_link_product import CheckoutLinkProduct
from polar.models.dispute import Dispute
from polar.models.organization import Organization
from polar.models.organization_access_token import OrganizationAccessToken
from polar.models.organization_agent_review import OrganizationAgentReview
from polar.models.organization_review import OrganizationReview
from polar.models.organization_review_feedback import OrganizationReviewFeedback
from polar.models.payment import Payment, PaymentStatus
from polar.models.product import Product
from polar.models.refund import Refund, RefundStatus
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.models.webhook_endpoint import WebhookEndpoint


class OrganizationReviewRepository(
    RepositorySoftDeletionIDMixin[OrganizationReview, UUID],
    RepositorySoftDeletionMixin[OrganizationReview],
    RepositoryBase[OrganizationReview],
):
    model = OrganizationReview

    async def save_agent_review(
        self,
        organization_id: UUID,
        review_type: str,
        report: dict[str, Any],
        model_used: str,
        reviewed_at: datetime,
    ) -> OrganizationAgentReview:
        """Create a new agent review record for the organization.

        The review_type is stored as a top-level key in the report JSONB column.
        """
        report_with_type = {**report, "review_type": review_type}
        agent_review = OrganizationAgentReview(
            organization_id=organization_id,
            report=report_with_type,
            model_used=model_used,
            reviewed_at=reviewed_at,
        )
        self.session.add(agent_review)
        return agent_review

    async def has_setup_complete_review(self, organization_id: UUID) -> bool:
        """Check if a SETUP_COMPLETE agent review already exists."""
        statement = select(func.count(OrganizationAgentReview.id)).where(
            OrganizationAgentReview.organization_id == organization_id,
            OrganizationAgentReview.report["review_type"].as_string()
            == "setup_complete",
        )
        result = await self.session.execute(statement)
        return (result.scalar() or 0) > 0

    async def get_latest_agent_review(
        self, organization_id: UUID
    ) -> OrganizationAgentReview | None:
        """Get the most recent agent review for an organization."""
        statement = (
            select(OrganizationAgentReview)
            .where(
                OrganizationAgentReview.organization_id == organization_id,
                OrganizationAgentReview.is_deleted.is_(False),
            )
            .order_by(OrganizationAgentReview.reviewed_at.desc())
            .limit(1)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_account_with_admin(self, account_id: UUID) -> Account | None:
        statement = (
            select(Account)
            .where(Account.id == account_id, Account.is_deleted.is_(False))
            .options(joinedload(Account.admin))
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_products_with_prices(self, organization_id: UUID) -> list[Product]:
        statement = (
            select(Product)
            .where(
                Product.organization_id == organization_id,
                Product.is_deleted.is_(False),
            )
            .options(selectinload(Product.prices))
        )
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def get_payment_stats(self, organization_id: UUID) -> tuple[int, int, int]:
        """Returns (total_payments, succeeded_payments, total_amount_cents)."""
        statement = select(
            func.count(Payment.id),
            func.count(Payment.id).filter(Payment.status == PaymentStatus.succeeded),
            func.coalesce(
                func.sum(Payment.amount).filter(
                    Payment.status == PaymentStatus.succeeded
                ),
                0,
            ),
        ).where(
            Payment.organization_id == organization_id,
            Payment.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1], row[2]

    async def get_risk_score_percentiles(
        self, organization_id: UUID
    ) -> tuple[int | None, int | None]:
        """Returns (p50_risk_score, p90_risk_score) computed in the database."""
        statement = select(
            func.percentile_cont(0.5).within_group(Payment.risk_score),
            func.percentile_cont(0.9).within_group(Payment.risk_score),
        ).where(
            Payment.organization_id == organization_id,
            Payment.status == PaymentStatus.succeeded,
            Payment.risk_score.is_not(None),
            Payment.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        row = result.one()
        p50 = int(row[0]) if row[0] is not None else None
        p90 = int(row[1]) if row[1] is not None else None
        return p50, p90

    async def get_refund_stats(self, organization_id: UUID) -> tuple[int, int]:
        """Returns (refund_count, refund_amount_cents)."""
        statement = select(
            func.count(Refund.id),
            func.coalesce(func.sum(Refund.amount), 0),
        ).where(
            Refund.organization_id == organization_id,
            Refund.status == RefundStatus.succeeded,
            Refund.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1]

    async def get_dispute_stats(self, organization_id: UUID) -> tuple[int, int]:
        """Returns (dispute_count, dispute_amount_cents)."""
        statement = select(
            func.count(Dispute.id),
            func.coalesce(func.sum(Dispute.amount), 0),
        ).where(
            Dispute.payment_id.in_(
                select(Payment.id).where(
                    Payment.organization_id == organization_id,
                    Payment.is_deleted.is_(False),
                )
            ),
            Dispute.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        row = result.one()
        return row[0], row[1]

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        statement = select(User).where(User.id == user_id)
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_other_organizations_for_user(
        self, user_id: UUID, exclude_organization_id: UUID
    ) -> list[Organization]:
        statement = (
            select(Organization)
            .join(
                UserOrganization,
                UserOrganization.organization_id == Organization.id,
            )
            .where(
                UserOrganization.user_id == user_id,
                Organization.id != exclude_organization_id,
                Organization.is_deleted.is_(False),
            )
            .options(joinedload(Organization.review))
        )
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def save_review_decision(
        self,
        *,
        organization_id: UUID,
        actor_type: str,
        decision: str,
        review_context: str,
        agent_review_id: UUID | None = None,
        reviewer_id: UUID | None = None,
        verdict: str | None = None,
        agreement: str | None = None,
        risk_score: float | None = None,
        reason: str | None = None,
        is_current: bool = True,
    ) -> OrganizationReviewFeedback:
        """Record a review decision (agent or human).

        Writes both new columns and old columns (dual-write) for backward
        compatibility during the expand-modify-contract migration.
        """
        now = utc_now()
        feedback = OrganizationReviewFeedback(
            # New columns
            organization_id=organization_id,
            actor_type=actor_type,
            decision=decision,
            review_context=review_context,
            verdict=verdict,
            risk_score=risk_score,
            reason=reason,
            is_current=is_current,
            # Old columns — dual-write for backward compat
            agent_review_id=agent_review_id,
            reviewer_id=reviewer_id,
            ai_verdict=verdict,
            human_verdict=decision if actor_type == "human" else None,
            agreement=agreement,
            override_reason=reason,
            reviewed_at=now,
        )
        self.session.add(feedback)
        return feedback

    async def record_human_decision(
        self,
        *,
        organization_id: UUID,
        reviewer_id: UUID,
        decision: str,
        review_context: str | None = None,
        reason: str | None = None,
    ) -> OrganizationReviewFeedback:
        """Record a human review decision with full context from the latest agent review.

        Looks up the latest agent review for the organization, derives the
        review_context from the agent review's review_type (falling back to
        "manual"), computes agreement between the AI verdict and human decision,
        deactivates any previous current decision, and saves the new one as current.

        If review_context is explicitly provided it takes precedence (e.g. "appeal").
        """
        agent_review = await self.get_latest_agent_review(organization_id)

        verdict: str | None = None
        risk_score: float | None = None
        agent_review_id: UUID | None = None
        agreement: str | None = None
        derived_context = review_context or "manual"

        if agent_review is not None:
            agent_review_id = agent_review.id
            report = agent_review.report.get("report", {})
            verdict = report.get("verdict")
            risk_score = report.get("overall_risk_score")

            if review_context is None:
                derived_context = agent_review.report.get("review_type", "manual")

            if verdict is not None:
                if decision == "APPROVE":
                    agreement = (
                        "AGREE" if verdict == "APPROVE" else "OVERRIDE_TO_APPROVE"
                    )
                else:
                    agreement = "AGREE" if verdict == "DENY" else "OVERRIDE_TO_DENY"

        await self.deactivate_current_decisions(organization_id)
        return await self.save_review_decision(
            organization_id=organization_id,
            actor_type="human",
            decision=decision,
            review_context=derived_context,
            agent_review_id=agent_review_id,
            reviewer_id=reviewer_id,
            verdict=verdict,
            agreement=agreement,
            risk_score=risk_score,
            reason=reason,
        )

    async def record_agent_decision(
        self,
        *,
        organization_id: UUID,
        agent_review_id: UUID,
        decision: str,
        review_context: str,
        verdict: str,
        risk_score: float | None = None,
    ) -> OrganizationReviewFeedback:
        """Record an automated agent decision.

        Deactivates any previous current decision and saves the new one as current.
        """
        await self.deactivate_current_decisions(organization_id)
        return await self.save_review_decision(
            organization_id=organization_id,
            actor_type="agent",
            decision=decision,
            review_context=review_context,
            agent_review_id=agent_review_id,
            verdict=verdict,
            risk_score=risk_score,
        )

    async def get_current_decision(
        self, organization_id: UUID
    ) -> OrganizationReviewFeedback | None:
        """Get the current (most recent active) decision for an organization."""
        statement = select(OrganizationReviewFeedback).where(
            OrganizationReviewFeedback.organization_id == organization_id,
            OrganizationReviewFeedback.is_current.is_(True),
            OrganizationReviewFeedback.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def deactivate_current_decisions(self, organization_id: UUID) -> None:
        """Set is_current=false for all current decisions of an organization."""
        statement = (
            update(OrganizationReviewFeedback)
            .where(
                OrganizationReviewFeedback.organization_id == organization_id,
                OrganizationReviewFeedback.is_current.is_(True),
                OrganizationReviewFeedback.deleted_at.is_(None),
            )
            .values(is_current=False)
        )
        await self.session.execute(statement)

    async def get_checkout_return_urls(
        self, organization_id: UUID, *, months: int = 3
    ) -> list[str]:
        """Get distinct non-null return URLs from recent checkouts.

        Uses SELECT DISTINCT on just the return_url column to avoid loading
        full checkout rows from this large table. The organization_id index
        keeps this efficient. Only looks at checkouts from the last *months*
        months to bound the scan on high-volume organizations.
        """
        cutoff = utc_now() - timedelta(days=months * 30)
        statement = (
            select(Checkout.return_url)
            .where(
                Checkout.organization_id == organization_id,
                Checkout.return_url.is_not(None),
                Checkout.is_deleted.is_(False),
                Checkout.created_at >= cutoff,
            )
            .distinct()
        )
        result = await self.session.execute(statement)
        return [row[0] for row in result.all()]

    async def get_checkout_links_with_benefits(
        self, organization_id: UUID
    ) -> list[CheckoutLink]:
        """Get checkout links with eagerly loaded products and their benefits."""
        statement = (
            select(CheckoutLink)
            .where(
                CheckoutLink.organization_id == organization_id,
                CheckoutLink.is_deleted.is_(False),
            )
            .options(
                selectinload(CheckoutLink.checkout_link_products)
                .joinedload(CheckoutLinkProduct.product)
                .selectinload(Product.product_benefits)
            )
        )
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def get_api_key_count(self, organization_id: UUID) -> int:
        """Count organization access tokens."""
        statement = select(func.count(OrganizationAccessToken.id)).where(
            OrganizationAccessToken.organization_id == organization_id,
            OrganizationAccessToken.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return result.scalar() or 0

    async def get_webhook_endpoints(
        self, organization_id: UUID
    ) -> list[WebhookEndpoint]:
        """Get webhook endpoints for the organization."""
        statement = select(WebhookEndpoint).where(
            WebhookEndpoint.organization_id == organization_id,
            WebhookEndpoint.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())
