"""
Billing Oracle Reporter: Emit structured mismatch events and alerts.

The Reporter:
1. Emits structured "billing mismatch" events for observability
2. Creates alerts for critical mismatches
3. Stores mismatch history for debugging
4. Provides dashboard-ready metrics

Integration points:
- Structlog for structured logging
- OpenTelemetry for traces/metrics
- Database storage for mismatch history
- Webhook notifications for critical alerts
"""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog

from polar.kit.db.postgres import AsyncSession
from polar.worker import enqueue_job

from .metrics import record_mismatch, record_reconciliation_result
from .models import (
    MismatchClassification,
    MismatchSeverity,
    OracleMismatch,
    ReconciliationResult,
)

log = structlog.get_logger(__name__)


class BillingOracleReporter:
    """
    Reporter for billing reconciliation results.

    Handles:
    - Structured logging of mismatches
    - Metrics emission (for Prometheus/OpenTelemetry)
    - Alert triggering for critical issues
    - Optional database storage of mismatch history
    """

    def __init__(
        self,
        session: AsyncSession | None = None,
        enable_alerts: bool = True,
        enable_metrics: bool = True,
    ):
        self.session = session
        self.enable_alerts = enable_alerts
        self.enable_metrics = enable_metrics

    async def report(self, result: ReconciliationResult) -> None:
        """
        Process and report a reconciliation result.

        This is the main entry point after reconciliation completes.
        """
        # Always log the result
        self._log_result(result)

        # Emit metrics
        if self.enable_metrics:
            self._emit_metrics(result)

        # Trigger alerts for critical/error mismatches
        if self.enable_alerts and result.has_errors:
            await self._trigger_alerts(result)

        # Optionally store mismatch history
        if self.session is not None and result.has_mismatches:
            await self._store_mismatches(result)

    def _log_result(self, result: ReconciliationResult) -> None:
        """Log the reconciliation result with structured data."""
        base_context = {
            "run_id": result.run_id,
            "orders_checked": result.orders_checked,
            "line_items_checked": result.line_items_checked,
            "mismatch_count": len(result.mismatches),
            "critical_count": result.critical_count,
            "error_count": result.error_count,
            "warning_count": result.warning_count,
            "info_count": result.info_count,
        }

        if result.subscription_id:
            base_context["subscription_id"] = str(result.subscription_id)
        if result.order_id:
            base_context["order_id"] = str(result.order_id)

        # Log summary
        if result.has_critical_mismatches:
            log.error(
                "billing_oracle.reconciliation.critical_mismatches",
                **base_context,
            )
        elif result.has_errors:
            log.warning(
                "billing_oracle.reconciliation.errors",
                **base_context,
            )
        elif result.has_mismatches:
            log.info(
                "billing_oracle.reconciliation.mismatches",
                **base_context,
            )
        else:
            log.debug(
                "billing_oracle.reconciliation.clean",
                **base_context,
            )

        # Log individual mismatches at appropriate levels
        for mismatch in result.mismatches:
            self._log_mismatch(mismatch)

    def _log_mismatch(self, mismatch: OracleMismatch) -> None:
        """Log a single mismatch with structured data."""
        context = {
            "mismatch_id": mismatch.id,
            "classification": mismatch.classification.value,
            "severity": mismatch.severity.value,
            "message": mismatch.message,
        }

        if mismatch.subscription_id:
            context["subscription_id"] = str(mismatch.subscription_id)
        if mismatch.order_id:
            context["order_id"] = str(mismatch.order_id)
        if mismatch.line_item_stable_id:
            context["line_item_stable_id"] = mismatch.line_item_stable_id
        if mismatch.expected_value is not None:
            context["expected_value"] = mismatch.expected_value
        if mismatch.actual_value is not None:
            context["actual_value"] = mismatch.actual_value
        if mismatch.difference is not None:
            context["difference"] = mismatch.difference

        match mismatch.severity:
            case MismatchSeverity.critical:
                log.error("billing_oracle.mismatch.critical", **context)
            case MismatchSeverity.error:
                log.error("billing_oracle.mismatch.error", **context)
            case MismatchSeverity.warning:
                log.warning("billing_oracle.mismatch.warning", **context)
            case MismatchSeverity.info:
                log.debug("billing_oracle.mismatch.info", **context)

    def _emit_metrics(self, result: ReconciliationResult) -> None:
        """
        Emit metrics for observability dashboards.

        Emits Prometheus metrics:
        - billing_oracle_reconciliation_total{status}
        - billing_oracle_mismatch_total{classification, severity}
        - billing_oracle_orders_checked_total
        - billing_oracle_line_items_checked_total
        - billing_oracle_reconciliation_duration_seconds
        """
        # Determine status and scope
        if result.has_critical_mismatches:
            status = "critical"
        elif result.has_errors:
            status = "error"
        elif result.has_mismatches:
            status = "warning"
        else:
            status = "clean"

        # Determine scope based on what was reconciled
        if result.order_id and not result.subscription_id:
            scope = "order"
        elif result.subscription_id and result.orders_checked <= 1:
            scope = "order"
        elif result.subscription_id:
            scope = "subscription"
        else:
            scope = "sweep"

        # Calculate duration
        duration = 0.0
        if result.completed_at:
            duration = (result.completed_at - result.started_at).total_seconds()

        # Emit reconciliation result metrics
        record_reconciliation_result(
            status=status,
            scope=scope,
            duration_seconds=duration,
            orders_checked=result.orders_checked,
            line_items_checked=result.line_items_checked,
        )

        # Emit individual mismatch metrics
        for mismatch in result.mismatches:
            amount_diff = None
            if isinstance(mismatch.difference, int):
                amount_diff = mismatch.difference
            record_mismatch(
                classification=mismatch.classification.value,
                severity=mismatch.severity.value,
                amount_difference=amount_diff,
            )

        # Also log for structured logging consumers
        log.info(
            "billing_oracle.metrics.reconciliation",
            run_id=result.run_id,
            status=status,
            scope=scope,
            orders_checked=result.orders_checked,
            line_items_checked=result.line_items_checked,
            duration_seconds=duration,
        )

    async def _trigger_alerts(self, result: ReconciliationResult) -> None:
        """
        Trigger alerts for critical/error mismatches.

        In production, this would:
        - Send Slack/PagerDuty notifications
        - Create incidents in incident management
        - Potentially auto-create issues
        """
        if result.has_critical_mismatches:
            log.critical(
                "billing_oracle.alert.critical",
                run_id=result.run_id,
                subscription_id=str(result.subscription_id) if result.subscription_id else None,
                order_id=str(result.order_id) if result.order_id else None,
                critical_count=result.critical_count,
                message="Critical billing mismatch detected - immediate attention required",
            )

            # Enqueue alert job for async processing
            enqueue_job(
                "billing_oracle.send_alert",
                result.run_id,
                "critical",
                result.to_dict(),
            )

        elif result.has_errors:
            log.error(
                "billing_oracle.alert.error",
                run_id=result.run_id,
                subscription_id=str(result.subscription_id) if result.subscription_id else None,
                order_id=str(result.order_id) if result.order_id else None,
                error_count=result.error_count,
                message="Billing mismatch errors detected",
            )

    async def _store_mismatches(self, result: ReconciliationResult) -> None:
        """
        Store mismatch history in the database for debugging.

        This allows:
        - Historical analysis of mismatch patterns
        - Linking mismatches to specific orders/subscriptions
        - Tracking mismatch resolution
        """
        # TODO: Create a billing_oracle_mismatches table and store records
        # For now, we rely on structured logging for history
        log.info(
            "billing_oracle.store_mismatches",
            run_id=result.run_id,
            mismatch_count=len(result.mismatches),
            message="Mismatch history would be stored here",
        )


def format_mismatch_summary(result: ReconciliationResult) -> str:
    """
    Format a human-readable summary of reconciliation results.

    Useful for CLI output and notifications.
    """
    lines = [
        f"Billing Oracle Reconciliation Report",
        f"=====================================",
        f"Run ID: {result.run_id}",
        f"Started: {result.started_at.isoformat()}",
        f"Completed: {result.completed_at.isoformat() if result.completed_at else 'In Progress'}",
        f"",
        f"Scope:",
    ]

    if result.subscription_id:
        lines.append(f"  Subscription: {result.subscription_id}")
    if result.order_id:
        lines.append(f"  Order: {result.order_id}")
    if result.period_start:
        lines.append(f"  Period: {result.period_start.isoformat()} to {result.period_end.isoformat() if result.period_end else '?'}")

    lines.extend([
        f"",
        f"Summary:",
        f"  Orders checked: {result.orders_checked}",
        f"  Line items checked: {result.line_items_checked}",
        f"  Total mismatches: {len(result.mismatches)}",
        f"",
        f"By Severity:",
        f"  Critical: {result.critical_count}",
        f"  Error: {result.error_count}",
        f"  Warning: {result.warning_count}",
        f"  Info: {result.info_count}",
    ])

    if result.mismatches:
        lines.extend([
            f"",
            f"Mismatches:",
        ])
        for mismatch in result.mismatches:
            lines.append(f"  [{mismatch.severity.value.upper()}] {mismatch.classification.value}: {mismatch.message}")
            if mismatch.expected_value is not None and mismatch.actual_value is not None:
                lines.append(f"    Expected: {mismatch.expected_value}, Actual: {mismatch.actual_value}")

    return "\n".join(lines)


# Singleton instance
billing_oracle_reporter = BillingOracleReporter()
