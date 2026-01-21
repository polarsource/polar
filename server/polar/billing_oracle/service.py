"""
Billing Oracle Service: High-level API for billing reconciliation.

This service provides the main entry points for:
- On-demand reconciliation (for specific orders/subscriptions)
- Sweep reconciliation (for recent orders)
- Integration with the subscription lifecycle

Usage:
    from polar.billing_oracle.service import billing_oracle_service

    # Reconcile a specific order
    result = await billing_oracle_service.reconcile_order(session, order_id)

    # Run nightly sweep
    result = await billing_oracle_service.run_sweep(session, hours=24)
"""

from datetime import datetime
from uuid import UUID

import structlog

from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Subscription

from .models import ReconciliationResult
from .oracle import BillingOracle
from .reconciler import BillingReconciler
from .reporter import BillingOracleReporter, format_mismatch_summary

log = structlog.get_logger(__name__)


class BillingOracleService:
    """
    High-level service for billing reconciliation.

    Coordinates between Oracle, Reconciler, and Reporter components.
    """

    def __init__(self):
        self.oracle = BillingOracle()

    async def reconcile_order(
        self,
        session: AsyncSession,
        order_id: UUID,
        report: bool = True,
    ) -> ReconciliationResult:
        """
        Reconcile a single order.

        Args:
            session: Database session
            order_id: The order to reconcile
            report: Whether to emit reports/alerts (default True)

        Returns:
            ReconciliationResult with any detected mismatches
        """
        reconciler = BillingReconciler(session, self.oracle)
        result = await reconciler.reconcile_order(order_id)

        if report:
            reporter = BillingOracleReporter(session)
            await reporter.report(result)

        return result

    async def reconcile_subscription(
        self,
        session: AsyncSession,
        subscription_id: UUID,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        report: bool = True,
    ) -> ReconciliationResult:
        """
        Reconcile all orders for a subscription.

        Args:
            session: Database session
            subscription_id: The subscription to reconcile
            period_start: Optional start of period to reconcile
            period_end: Optional end of period to reconcile
            report: Whether to emit reports/alerts (default True)

        Returns:
            ReconciliationResult with any detected mismatches
        """
        reconciler = BillingReconciler(session, self.oracle)
        result = await reconciler.reconcile_subscription(
            subscription_id, period_start, period_end
        )

        if report:
            reporter = BillingOracleReporter(session)
            await reporter.report(result)

        return result

    async def run_sweep(
        self,
        session: AsyncSession,
        hours: int = 24,
        limit: int = 1000,
        report: bool = True,
    ) -> ReconciliationResult:
        """
        Run sweep reconciliation on recent orders.

        This is the "nightly sweep" mode that reconciles all orders
        created in the last N hours.

        Args:
            session: Database session
            hours: Number of hours to look back (default 24)
            limit: Maximum orders to check (default 1000)
            report: Whether to emit reports/alerts (default True)

        Returns:
            ReconciliationResult with any detected mismatches
        """
        log.info(
            "billing_oracle.sweep.starting",
            hours=hours,
            limit=limit,
        )

        reconciler = BillingReconciler(session, self.oracle)
        result = await reconciler.reconcile_recent_orders(hours, limit)

        if report:
            reporter = BillingOracleReporter(session)
            await reporter.report(result)

        log.info(
            "billing_oracle.sweep.completed",
            run_id=result.run_id,
            orders_checked=result.orders_checked,
            mismatch_count=len(result.mismatches),
            has_errors=result.has_errors,
        )

        return result

    async def validate_order_before_create(
        self,
        session: AsyncSession,
        subscription: Subscription,
        expected_subtotal: int,
        expected_items_count: int,
    ) -> list[str]:
        """
        Quick validation before order creation.

        This is a lightweight check that can run synchronously during
        order creation to catch obvious issues.

        Returns:
            List of warning messages (empty if all checks pass)
        """
        warnings: list[str] = []

        # Check conservation: subscription amount vs expected subtotal
        # Allow some tolerance for prorations and discounts
        expected_from_subscription = subscription.amount
        if abs(expected_subtotal - expected_from_subscription) > 100:  # $1 tolerance
            warnings.append(
                f"Subtotal {expected_subtotal} differs significantly from "
                f"subscription amount {expected_from_subscription}"
            )

        # Check we have at least one item
        if expected_items_count == 0:
            warnings.append("Order has no line items")

        # Check subscription is in billable state
        if not subscription.billable:
            warnings.append(f"Subscription status {subscription.status} is not billable")

        return warnings

    def get_summary(self, result: ReconciliationResult) -> str:
        """Get a formatted summary of reconciliation results."""
        return format_mismatch_summary(result)


# Singleton instance
billing_oracle_service = BillingOracleService()
