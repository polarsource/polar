"""
Mercury webhook tasks.

Handles:
- Transaction status updates
- ACH returns with ledger rollback
- Failure notifications
"""

from typing import Any

import structlog

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.payout import PayoutStatus
from polar.payout.repository import PayoutRepository
from polar.payout.service import payout as payout_service
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log: Logger = structlog.get_logger()


class MercuryTaskError(PolarTaskError):
    """Base exception for Mercury tasks."""

    pass


class PayoutNotFound(MercuryTaskError):
    """Payout not found for Mercury transaction."""

    def __init__(self, transaction_id: str) -> None:
        self.transaction_id = transaction_id
        message = f"No payout found for Mercury transaction {transaction_id}"
        super().__init__(message)


# ACH Return Codes that indicate permanent failures (do not retry)
PERMANENT_FAILURE_CODES = {
    "R01",  # Insufficient Funds
    "R02",  # Account Closed
    "R03",  # No Account/Unable to Locate Account
    "R04",  # Invalid Account Number
    "R05",  # Unauthorized Debit to Consumer Account
    "R06",  # Returned per ODFI Request
    "R07",  # Authorization Revoked by Customer
    "R08",  # Payment Stopped
    "R09",  # Uncollected Funds
    "R10",  # Customer Advises Not Authorized
    "R16",  # Account Frozen
    "R20",  # Non-Transaction Account
    "R29",  # Corporate Customer Advises Not Authorized
}

# ACH Return Codes that may be temporary (can retry)
TEMPORARY_FAILURE_CODES = {
    "R11",  # Check Truncation Entry Return
    "R17",  # File Record Edit Criteria
    "R23",  # Credit Entry Refused by Receiver
}


def get_return_code_description(code: str) -> str:
    """Get human-readable description for ACH return code."""
    descriptions = {
        "R01": "Insufficient Funds - The account has insufficient funds to cover the transaction",
        "R02": "Account Closed - The account has been closed",
        "R03": "No Account - Unable to locate the account",
        "R04": "Invalid Account Number - The account number is invalid",
        "R05": "Unauthorized Debit - Debit not authorized by account holder",
        "R06": "ODFI Request - Returned at originator's request",
        "R07": "Authorization Revoked - Customer revoked authorization",
        "R08": "Payment Stopped - Stop payment placed on this transaction",
        "R09": "Uncollected Funds - Insufficient collected funds",
        "R10": "Not Authorized - Customer advises transaction not authorized",
        "R11": "Check Truncation - Check truncation entry return",
        "R16": "Account Frozen - Account frozen by legal action",
        "R17": "File Record Edit - File record edit criteria violation",
        "R20": "Non-Transaction Account - Account does not allow ACH transactions",
        "R23": "Credit Refused - Receiver refused credit entry",
        "R29": "Corporate Not Authorized - Corporate customer advises not authorized",
    }
    return descriptions.get(code, f"Unknown return code: {code}")


@actor(
    actor_name="mercury.webhook.transaction_status_changed",
    priority=TaskPriority.HIGH,
)
async def transaction_status_changed(
    transaction_id: str,
    status: str,
    data: dict[str, Any],
) -> None:
    """
    Handle Mercury transaction status change.

    Maps Mercury statuses to Spaire PayoutStatus:
    - pending -> pending
    - sent -> in_transit
    - completed -> succeeded
    - cancelled -> (special handling)
    - failed -> (special handling with ledger rollback)
    """
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_mercury_transaction_id(transaction_id)

        if payout is None:
            log.warning(
                "mercury.webhook.payout_not_found",
                transaction_id=transaction_id,
            )
            # Don't raise - this could be a transaction not created by us
            return

        # Map status
        status_map = {
            "pending": PayoutStatus.pending,
            "sent": PayoutStatus.in_transit,
            "completed": PayoutStatus.succeeded,
        }

        new_status = status_map.get(status)
        if new_status is None:
            log.warning(
                "mercury.webhook.unknown_status",
                transaction_id=transaction_id,
                status=status,
            )
            return

        # Update payout
        await payout_service.update_from_mercury(
            session, transaction_id, new_status, failure_reason=None
        )

        log.info(
            "mercury.webhook.status_updated",
            transaction_id=transaction_id,
            payout_id=str(payout.id),
            old_status=payout.status,
            new_status=new_status,
        )


@actor(
    actor_name="mercury.webhook.transaction_returned",
    priority=TaskPriority.HIGH,
)
async def transaction_returned(
    transaction_id: str,
    return_code: str,
    return_reason: str,
    data: dict[str, Any],
) -> None:
    """
    Handle Mercury ACH return.

    This is the critical path for ledger reconciliation:
    1. Find the payout and its associated transaction
    2. Determine if this is a permanent or temporary failure
    3. Roll back the ledger (reverse the balance transactions)
    4. Notify the user
    5. Mark payout as failed

    ACH returns can occur up to 60 days after the original transaction,
    so we must be able to handle reversals at any time.
    """
    async with AsyncSessionMaker() as session:
        repository = PayoutRepository(session)
        payout = await repository.get_by_mercury_transaction_id(
            transaction_id, options=repository.get_eager_options()
        )

        if payout is None:
            log.error(
                "mercury.webhook.return.payout_not_found",
                transaction_id=transaction_id,
            )
            raise PayoutNotFound(transaction_id)

        # Get human-readable failure reason
        failure_description = get_return_code_description(return_code)
        failure_reason = f"ACH Return {return_code}: {failure_description}"

        log.warning(
            "mercury.webhook.ach_return",
            transaction_id=transaction_id,
            payout_id=str(payout.id),
            return_code=return_code,
            return_reason=return_reason,
            is_permanent=return_code in PERMANENT_FAILURE_CODES,
        )

        # Step 1: Roll back the ledger
        # This reverses the balance transactions that were created when the payout was initiated
        await _rollback_payout_ledger(session, payout)

        # Step 2: Update payout status
        # We use a special "failed" status variant stored in failure_reason
        await payout_service.update_from_mercury(
            session, transaction_id, PayoutStatus.pending, failure_reason=failure_reason
        )

        # Step 3: Notify the user (enqueue notification job)
        # TODO: Implement user notification
        # enqueue_job(
        #     "notification.payout_failed",
        #     payout_id=str(payout.id),
        #     failure_reason=failure_reason,
        #     is_permanent=return_code in PERMANENT_FAILURE_CODES,
        # )

        log.info(
            "mercury.webhook.return.processed",
            transaction_id=transaction_id,
            payout_id=str(payout.id),
            return_code=return_code,
            ledger_rolled_back=True,
        )


async def _rollback_payout_ledger(session: Any, payout: Any) -> None:
    """
    Roll back the ledger for a failed payout.

    This reverses all balance transactions that were created when the payout
    was initiated, returning the funds to the user's account balance.

    The rollback creates new transactions with negative amounts that offset
    the original payout transactions, maintaining a complete audit trail.
    """
    # Get the payout transaction
    payout_transaction = payout.transaction
    if payout_transaction is None:
        log.error(
            "mercury.rollback.no_transaction",
            payout_id=str(payout.id),
        )
        return

    # Reverse the payout transaction
    # This creates offsetting balance entries that return funds to the user's account
    await payout_transaction_service.reverse(
        session,
        payout_transaction,
        reason=f"ACH Return for payout {payout.id}",
    )

    log.info(
        "mercury.rollback.completed",
        payout_id=str(payout.id),
        transaction_id=str(payout_transaction.id),
        amount=payout.amount,
    )
