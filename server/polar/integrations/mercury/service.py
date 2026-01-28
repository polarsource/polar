"""
Mercury Service.

High-level service for Mercury operations including:
- Recipient management (ensure recipient exists before payout)
- Payout execution with RTP/ACH routing
- Status mapping and webhook handling
"""

from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any

import structlog

from polar.config import settings
from polar.kit.crypto import decrypt_string, get_last4
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Account
from polar.models.account_bank_details import AccountBankDetails
from polar.models.payout import PayoutStatus
from polar.postgres import AsyncSession

from .client import MercuryClient, PaymentMethod, TransactionStatus

log: Logger = structlog.get_logger()


class PayoutMethod(StrEnum):
    """Spaire payout methods (maps to Mercury payment methods)."""

    ACH = "ach"
    SAME_DAY_ACH = "same_day_ach"
    RTP = "rtp"
    WIRE = "wire"


class MercuryPayoutResult:
    """Result of a Mercury payout operation."""

    def __init__(
        self,
        *,
        transaction_id: str,
        status: PayoutStatus,
        payout_method: PayoutMethod,
        estimated_arrival: datetime | None = None,
        failure_reason: str | None = None,
    ):
        self.transaction_id = transaction_id
        self.status = status
        self.payout_method = payout_method
        self.estimated_arrival = estimated_arrival
        self.failure_reason = failure_reason


class MercuryService:
    """
    High-level Mercury operations.

    Handles recipient creation, payout routing (RTP vs ACH), and status mapping.
    """

    def __init__(self, client: MercuryClient | None = None):
        self._client = client

    @property
    def client(self) -> MercuryClient:
        if self._client is None:
            self._client = MercuryClient()
        return self._client

    # -------------------------------------------------------------------------
    # Recipient Management (Phase 2 Core)
    # -------------------------------------------------------------------------

    async def ensure_recipient_exists(
        self,
        session: AsyncSession,
        bank_details: AccountBankDetails,
        account_name: str,
    ) -> str:
        """
        Ensure a Mercury recipient exists for the given bank details.

        If mercury_recipient_id is already set, verifies it still exists.
        Otherwise, creates a new recipient.

        Args:
            session: Database session
            bank_details: AccountBankDetails with encrypted bank info
            account_name: Name to use for the recipient

        Returns:
            Mercury recipient ID
        """
        # Check if recipient already exists
        if bank_details.mercury_recipient_id:
            try:
                # Verify recipient still exists in Mercury
                recipient = await self.client.get_recipient(
                    bank_details.mercury_recipient_id
                )
                log.info(
                    "mercury.recipient.exists",
                    recipient_id=bank_details.mercury_recipient_id,
                    status=recipient.get("status"),
                )
                return bank_details.mercury_recipient_id
            except Exception as e:
                log.warning(
                    "mercury.recipient.not_found",
                    recipient_id=bank_details.mercury_recipient_id,
                    error=str(e),
                )
                # Fall through to create new recipient

        # Decrypt bank details
        routing_number = decrypt_string(bank_details.routing_number_encrypted)
        account_number = decrypt_string(bank_details.account_number_encrypted)

        # Create recipient with idempotency key based on account ID
        idempotency_key = f"recipient-{bank_details.account_id}"

        recipient = await self.client.create_recipient(
            name=account_name,
            routing_number=routing_number,
            account_number=account_number,
            account_type=bank_details.account_type.value,
            idempotency_key=idempotency_key,
        )

        recipient_id = recipient["id"]

        # Update bank details with recipient ID
        bank_details.mercury_recipient_id = recipient_id
        bank_details.mercury_recipient_created_at = utc_now()
        session.add(bank_details)
        await session.flush()

        log.info(
            "mercury.recipient.created",
            recipient_id=recipient_id,
            account_id=str(bank_details.account_id),
            last4=bank_details.account_number_last4,
        )

        return recipient_id

    # -------------------------------------------------------------------------
    # Payout Routing Logic (Phase 3 Core)
    # -------------------------------------------------------------------------

    def detect_optimal_payout_method(
        self,
        bank_details: AccountBankDetails,
    ) -> PayoutMethod:
        """
        Detect the optimal payout method based on routing number.

        Mercury-native routing numbers (Column N.A., Choice Financial) support
        instant RTP transfers. All others use Same-Day ACH or standard ACH.

        Args:
            bank_details: Bank details with routing number

        Returns:
            Optimal PayoutMethod (rtp, same_day_ach, or ach)
        """
        routing_number = decrypt_string(bank_details.routing_number_encrypted)

        # Check if RTP is enabled and routing number supports it
        if settings.MERCURY_RTP_ENABLED:
            if routing_number in settings.MERCURY_NATIVE_ROUTING_NUMBERS:
                log.info(
                    "mercury.payout.rtp_eligible",
                    routing_number=routing_number[:3] + "***" + routing_number[-2:],
                )
                return PayoutMethod.RTP

        # Fall back to Same-Day ACH if enabled
        if settings.MERCURY_SAME_DAY_ACH_ENABLED:
            return PayoutMethod.SAME_DAY_ACH

        # Default to standard ACH
        return PayoutMethod.ACH

    def _map_payout_method_to_mercury(
        self, payout_method: PayoutMethod
    ) -> PaymentMethod:
        """Map Spaire payout method to Mercury payment method."""
        return {
            PayoutMethod.ACH: PaymentMethod.ACH,
            PayoutMethod.SAME_DAY_ACH: PaymentMethod.SAME_DAY_ACH,
            PayoutMethod.RTP: PaymentMethod.RTP,
            PayoutMethod.WIRE: PaymentMethod.WIRE,
        }[payout_method]

    def _estimate_arrival(self, payout_method: PayoutMethod) -> datetime:
        """Estimate arrival time based on payout method."""
        now = utc_now()

        if payout_method == PayoutMethod.RTP:
            # RTP: instant, within seconds
            return now + timedelta(minutes=1)
        elif payout_method == PayoutMethod.SAME_DAY_ACH:
            # Same-Day ACH: same business day if before cutoff
            return now + timedelta(hours=4)
        elif payout_method == PayoutMethod.WIRE:
            # Wire: same day
            return now + timedelta(hours=2)
        else:
            # Standard ACH: 1-3 business days
            return now + timedelta(days=2)

    # -------------------------------------------------------------------------
    # Payout Execution
    # -------------------------------------------------------------------------

    async def create_payout(
        self,
        *,
        recipient_id: str,
        amount_cents: int,
        payout_id: str,
        payout_method: PayoutMethod | None = None,
        note: str | None = None,
    ) -> MercuryPayoutResult:
        """
        Create a payout to a recipient.

        Args:
            recipient_id: Mercury recipient ID
            amount_cents: Amount in cents (will be converted to dollars)
            payout_id: Spaire payout ID for idempotency and tracking
            payout_method: Optional override for payout method
            note: Optional internal note

        Returns:
            MercuryPayoutResult with transaction details
        """
        # Convert cents to dollars for Mercury
        amount_dollars = amount_cents / 100

        # Default to ACH if not specified
        if payout_method is None:
            payout_method = PayoutMethod.ACH

        mercury_method = self._map_payout_method_to_mercury(payout_method)

        # Create transaction with idempotency key
        idempotency_key = f"payout-{payout_id}"

        transaction = await self.client.create_transaction(
            recipient_id=recipient_id,
            amount=amount_dollars,
            payment_method=mercury_method,
            note=note or f"Spaire payout {payout_id}",
            external_memo=f"Spaire Revenue Payout",
            idempotency_key=idempotency_key,
        )

        transaction_id = transaction["id"]
        status = self._map_transaction_status(transaction.get("status", "pending"))
        estimated_arrival = self._estimate_arrival(payout_method)

        log.info(
            "mercury.payout.created",
            transaction_id=transaction_id,
            payout_id=payout_id,
            amount_dollars=amount_dollars,
            method=payout_method.value,
            status=status.value,
        )

        return MercuryPayoutResult(
            transaction_id=transaction_id,
            status=status,
            payout_method=payout_method,
            estimated_arrival=estimated_arrival,
        )

    # -------------------------------------------------------------------------
    # Status Mapping
    # -------------------------------------------------------------------------

    def _map_transaction_status(self, mercury_status: str) -> PayoutStatus:
        """Map Mercury transaction status to Spaire PayoutStatus."""
        status_map = {
            "pending": PayoutStatus.pending,
            "sent": PayoutStatus.in_transit,
            "completed": PayoutStatus.succeeded,
            "cancelled": PayoutStatus.pending,  # Will need special handling
            "failed": PayoutStatus.pending,  # Will need special handling
        }
        return status_map.get(mercury_status, PayoutStatus.pending)

    def map_webhook_status(
        self, webhook_payload: dict[str, Any]
    ) -> tuple[PayoutStatus, str | None]:
        """
        Map Mercury webhook payload to payout status and failure reason.

        Args:
            webhook_payload: Mercury webhook payload

        Returns:
            Tuple of (PayoutStatus, failure_reason or None)
        """
        status = webhook_payload.get("status", "")
        failure_reason = None

        if status == "completed":
            return PayoutStatus.succeeded, None
        elif status == "sent":
            return PayoutStatus.in_transit, None
        elif status == "failed":
            # Extract failure details
            failure_reason = webhook_payload.get("failureReason", "Unknown error")
            return PayoutStatus.pending, failure_reason  # Will be handled as failed
        elif status == "returned":
            # ACH return - extract return code
            return_code = webhook_payload.get("returnCode", "")
            return_reason = webhook_payload.get("returnReason", "")
            failure_reason = f"ACH Return {return_code}: {return_reason}"
            return PayoutStatus.pending, failure_reason  # Will be handled as returned

        return PayoutStatus.pending, None

    # -------------------------------------------------------------------------
    # Balance Check
    # -------------------------------------------------------------------------

    async def check_sufficient_balance(self, amount_cents: int) -> bool:
        """
        Check if Mercury account has sufficient balance for payout.

        Args:
            amount_cents: Required amount in cents

        Returns:
            True if balance is sufficient
        """
        balance = await self.client.get_account_balance()
        available = balance["available_balance"] * 100  # Convert to cents

        sufficient = available >= amount_cents
        log.info(
            "mercury.balance.check",
            required_cents=amount_cents,
            available_cents=available,
            sufficient=sufficient,
        )

        return sufficient


# Singleton instance
mercury = MercuryService()
