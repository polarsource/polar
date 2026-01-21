"""
Background tasks for Billing Oracle.

Tasks:
- billing_oracle.reconcile_order: Reconcile a single order (async after order creation)
- billing_oracle.reconcile_subscription: Reconcile all orders for a subscription
- billing_oracle.sweep: Nightly sweep reconciliation
- billing_oracle.send_alert: Send alerts for critical mismatches
"""

from datetime import datetime
from uuid import UUID

import structlog

from polar.logging import Logger
from polar.postgres import AsyncSession
from polar.worker import JobContext, PolarWorkerContext, enqueue_job, task

from .service import billing_oracle_service

log: Logger = structlog.get_logger(__name__)


@task("billing_oracle.reconcile_order")
async def reconcile_order(
    ctx: JobContext,
    order_id: UUID,
    polar_context: PolarWorkerContext,
) -> None:
    """
    Reconcile a single order.

    This task is typically enqueued after an order is created
    to verify billing correctness.
    """
    async with polar_context.to_async_session() as session:
        log.info("billing_oracle.task.reconcile_order.start", order_id=str(order_id))

        result = await billing_oracle_service.reconcile_order(session, order_id)

        log.info(
            "billing_oracle.task.reconcile_order.complete",
            order_id=str(order_id),
            run_id=result.run_id,
            mismatch_count=len(result.mismatches),
            has_errors=result.has_errors,
        )


@task("billing_oracle.reconcile_subscription")
async def reconcile_subscription(
    ctx: JobContext,
    subscription_id: UUID,
    period_start: datetime | None,
    period_end: datetime | None,
    polar_context: PolarWorkerContext,
) -> None:
    """
    Reconcile all orders for a subscription.

    Can be used for ad-hoc investigation or scheduled checks.
    """
    async with polar_context.to_async_session() as session:
        log.info(
            "billing_oracle.task.reconcile_subscription.start",
            subscription_id=str(subscription_id),
            period_start=period_start.isoformat() if period_start else None,
            period_end=period_end.isoformat() if period_end else None,
        )

        result = await billing_oracle_service.reconcile_subscription(
            session, subscription_id, period_start, period_end
        )

        log.info(
            "billing_oracle.task.reconcile_subscription.complete",
            subscription_id=str(subscription_id),
            run_id=result.run_id,
            orders_checked=result.orders_checked,
            mismatch_count=len(result.mismatches),
            has_errors=result.has_errors,
        )


@task("billing_oracle.sweep")
async def sweep(
    ctx: JobContext,
    hours: int,
    limit: int,
    polar_context: PolarWorkerContext,
) -> None:
    """
    Run sweep reconciliation on recent orders.

    This is typically scheduled to run nightly.
    """
    async with polar_context.to_async_session() as session:
        log.info(
            "billing_oracle.task.sweep.start",
            hours=hours,
            limit=limit,
        )

        result = await billing_oracle_service.run_sweep(session, hours, limit)

        log.info(
            "billing_oracle.task.sweep.complete",
            run_id=result.run_id,
            orders_checked=result.orders_checked,
            mismatch_count=len(result.mismatches),
            critical_count=result.critical_count,
            error_count=result.error_count,
        )


@task("billing_oracle.send_alert")
async def send_alert(
    ctx: JobContext,
    run_id: str,
    severity: str,
    result_dict: dict,
    polar_context: PolarWorkerContext,
) -> None:
    """
    Send alerts for critical/error mismatches.

    This task handles the actual alert delivery (Slack, email, etc.)
    after being enqueued by the Reporter.
    """
    log.info(
        "billing_oracle.task.send_alert.start",
        run_id=run_id,
        severity=severity,
    )

    # TODO: Implement actual alert delivery
    # For now, this is a placeholder that logs the alert
    mismatch_count = len(result_dict.get("mismatches", []))
    subscription_id = result_dict.get("subscription_id")
    order_id = result_dict.get("order_id")

    log.warning(
        "billing_oracle.alert.would_send",
        run_id=run_id,
        severity=severity,
        mismatch_count=mismatch_count,
        subscription_id=subscription_id,
        order_id=order_id,
        message=f"Would send {severity} alert for {mismatch_count} mismatches",
    )


def schedule_order_reconciliation(order_id: UUID) -> None:
    """
    Schedule reconciliation for an order.

    Call this after order creation to async-verify billing correctness.
    """
    enqueue_job("billing_oracle.reconcile_order", order_id)


def schedule_subscription_reconciliation(
    subscription_id: UUID,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
) -> None:
    """
    Schedule reconciliation for a subscription.
    """
    enqueue_job(
        "billing_oracle.reconcile_subscription",
        subscription_id,
        period_start,
        period_end,
    )


def schedule_sweep(hours: int = 24, limit: int = 1000) -> None:
    """
    Schedule a sweep reconciliation.

    Typically called by a cron job for nightly sweeps.
    """
    enqueue_job("billing_oracle.sweep", hours, limit)
