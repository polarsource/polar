"""Analytics service for organization account review functionality."""

from pydantic import UUID4
from sqlalchemy import func, select

from polar.models import (
    Benefit,
    CheckoutLink,
    Customer,
    Order,
    Organization,
    OrganizationAccessToken,
    Payment,
    Product,
    Refund,
    WebhookEndpoint,
)
from polar.models.payment import PaymentStatus
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession


class PaymentAnalyticsService:
    """Service for computing payment statistics and analytics."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.payment_repo = PaymentRepository.from_session(session)

    async def get_organization_account_id(self, organization_id: UUID4) -> UUID4 | None:
        """Get account ID for organization."""
        result = await self.session.execute(
            select(Organization.account_id).where(Organization.id == organization_id)
        )
        row = result.first()
        return row[0] if row else None

    async def get_succeeded_payments_stats(
        self, organization_id: UUID4
    ) -> tuple[int, int, list[float]]:
        """Get succeeded payments count, total amount, and risk scores."""
        statement = self.payment_repo.get_base_statement().where(
            Payment.organization_id == organization_id,
            Payment.status == PaymentStatus.succeeded,
        )

        # Get risk scores
        risk_scores_result = await self.session.execute(
            statement.where(Payment.risk_score.isnot(None)).with_only_columns(
                Payment.risk_score
            )
        )
        risk_scores = [row[0] for row in risk_scores_result if row[0] is not None]

        # Get count and total amount
        stats_result = await self.session.execute(
            statement.with_only_columns(
                func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)
            )
        )
        count, total_amount = stats_result.first() or (0, 0)

        return count, total_amount, risk_scores

    async def get_refund_stats(self, organization_id: UUID4) -> tuple[int, int]:
        """Get refund count and total amount for organization."""
        result = await self.session.execute(
            select(func.count(Refund.id), func.coalesce(func.sum(Refund.amount), 0))
            .join(Order, Refund.order_id == Order.id)
            .join(Customer, Order.customer_id == Customer.id)
            .where(Customer.organization_id == organization_id)
        )
        result_row = result.first()
        if result_row:
            return (result_row[0], result_row[1])
        return (0, 0)

    @staticmethod
    def calculate_risk_percentiles(risk_scores: list[float]) -> tuple[float, float]:
        """Calculate P50 and P90 risk percentiles."""
        if not risk_scores:
            return 0.0, 0.0

        # Create a copy to avoid mutating the original list
        sorted_scores: list[float] = sorted(risk_scores)
        n = len(sorted_scores)

        # Calculate P50 (median)
        if n % 2 == 0:
            p50_risk = (sorted_scores[n // 2 - 1] + sorted_scores[n // 2]) / 2
        else:
            p50_risk = sorted_scores[n // 2]

        # Calculate P90
        p90_index = int(0.9 * n)
        if p90_index >= n:
            p90_index = n - 1
        p90_risk = sorted_scores[p90_index]

        return p50_risk, p90_risk

    @staticmethod
    def determine_risk_level(p90_risk: float) -> str:
        """Determine risk level based on P90 risk score."""
        if p90_risk < 65:
            return "green"
        elif p90_risk < 75:
            return "yellow"
        else:
            return "red"


class OrganizationSetupAnalyticsService:
    """Service for computing organization setup statistics and analytics."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_checkout_links_count(self, organization_id: UUID4) -> int:
        """Get count of checkout links for organization."""
        result = await self.session.execute(
            select(func.count(CheckoutLink.id)).where(
                CheckoutLink.organization_id == organization_id,
                CheckoutLink.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def get_webhooks_count(self, organization_id: UUID4) -> int:
        """Get count of webhook endpoints for organization."""
        result = await self.session.execute(
            select(func.count(WebhookEndpoint.id)).where(
                WebhookEndpoint.organization_id == organization_id,
                WebhookEndpoint.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def get_organization_tokens_count(self, organization_id: UUID4) -> int:
        """Get count of organization access tokens."""
        result = await self.session.execute(
            select(func.count(OrganizationAccessToken.id)).where(
                OrganizationAccessToken.organization_id == organization_id,
                OrganizationAccessToken.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def get_products_count(self, organization_id: UUID4) -> int:
        """Get count of products for organization."""
        result = await self.session.execute(
            select(func.count(Product.id)).where(
                Product.organization_id == organization_id,
                Product.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def get_benefits_count(self, organization_id: UUID4) -> int:
        """Get count of benefits for organization."""
        result = await self.session.execute(
            select(func.count(Benefit.id)).where(
                Benefit.organization_id == organization_id,
                Benefit.deleted_at.is_(None),
            )
        )
        return result.scalar() or 0

    async def check_user_verified_in_stripe(self, organization: Organization) -> bool:
        """Check if organization owner is verified in Stripe."""
        if not organization.account or not organization.account.stripe_id:
            return False

        # This would need to be implemented based on your Stripe integration
        # For now, return a placeholder
        return (
            hasattr(organization.account, "charges_enabled")
            and organization.account.charges_enabled
        )

    async def check_account_enabled(
        self, organization: Organization
    ) -> tuple[bool, bool]:
        """Check if account charges and payouts are enabled."""
        if not organization.account:
            return False, False

        charges_enabled = getattr(organization.account, "charges_enabled", False)
        payouts_enabled = getattr(organization.account, "payouts_enabled", False)

        return charges_enabled, payouts_enabled

    @staticmethod
    def calculate_setup_score(
        checkout_links_count: int,
        webhooks_count: int,
        org_tokens_count: int,
        products_count: int,
        benefits_count: int,
        user_verified: bool,
        account_charges_enabled: bool,
        account_payouts_enabled: bool,
    ) -> int:
        """Calculate setup score based on various metrics."""
        return sum(
            [
                1 if checkout_links_count > 0 else 0,
                1 if webhooks_count > 0 else 0,
                1 if org_tokens_count > 0 else 0,
                1 if products_count > 0 else 0,
                1 if benefits_count > 0 else 0,
                1 if user_verified else 0,
                1 if account_charges_enabled else 0,
                1 if account_payouts_enabled else 0,
            ]
        )
