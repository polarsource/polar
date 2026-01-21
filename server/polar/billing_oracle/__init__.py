"""
Billing Oracle: Deterministic billing simulator and reconciler.

The Oracle system simulates expected billing outcomes and compares them against
actual production artifacts (invoices, ledger entries, subscription state).

Components:
- models: Canonical domain model (pure functions, immutable data)
- oracle: Simulation engine that computes expected artifacts
- reconciler: Diff expected vs actual, classify mismatches
- reporter: Emit structured mismatch events and alerts
- service: High-level API for reconciliation
- tasks: Background jobs for automated reconciliation

Usage:
    from polar.billing_oracle.service import billing_oracle_service

    # Reconcile a specific order
    result = await billing_oracle_service.reconcile_order(session, order_id)

    # Run nightly sweep
    result = await billing_oracle_service.run_sweep(session, hours=24)

    # Schedule background reconciliation after order creation
    from polar.billing_oracle.tasks import schedule_order_reconciliation
    schedule_order_reconciliation(order.id)
"""

from polar.billing_oracle.models import (
    ExpectedLineItem,
    ExpectedOrder,
    MismatchClassification,
    MismatchSeverity,
    OracleMismatch,
    ReconciliationResult,
)
from polar.billing_oracle.oracle import BillingOracle, billing_oracle
from polar.billing_oracle.reconciler import BillingReconciler
from polar.billing_oracle.service import BillingOracleService, billing_oracle_service

__all__ = [
    # Oracle components
    "BillingOracle",
    "billing_oracle",
    "BillingReconciler",
    "BillingOracleService",
    "billing_oracle_service",
    # Models
    "ExpectedLineItem",
    "ExpectedOrder",
    "MismatchClassification",
    "MismatchSeverity",
    "OracleMismatch",
    "ReconciliationResult",
]
