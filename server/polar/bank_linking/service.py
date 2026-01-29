"""
Bank Linking Service.

Orchestrates the flow from Stripe Financial Connections to Mercury recipient creation:
1. Create Financial Connections session
2. Handle completion and extract bank details
3. Encrypt and store bank details
4. Create Mercury recipient
5. Detect RTP eligibility

SECURITY: Raw account numbers are NEVER logged or stored in plain text.
"""

from uuid import UUID

import structlog

from polar.account.repository import AccountRepository
from polar.account_bank_details.service import account_bank_details
from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.mercury.service import mercury as mercury_service
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.crypto import decrypt_string, get_last4
from polar.logging import Logger
from polar.models import Account
from polar.models.account_bank_details import AccountBankDetails
from polar.postgres import AsyncSession

from .schemas import BankAccountInfo, BankLinkingSession, BankLinkingStatus

log: Logger = structlog.get_logger()


class BankLinkingError(PolarError):
    """Base exception for bank linking operations."""

    pass


class AccountNotFound(BankLinkingError):
    """Account not found."""

    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        super().__init__(f"Account {account_id} not found", 404)


class AccountNotActive(BankLinkingError):
    """Account is not in active status."""

    def __init__(self, account: Account) -> None:
        self.account = account
        super().__init__(
            "Account must be active to link a bank account. "
            "Please complete KYB verification first.",
            400,
        )


class FinancialConnectionsAccountNotActive(BankLinkingError):
    """Financial Connections account is not active."""

    def __init__(self, status: str) -> None:
        self.status = status
        super().__init__(
            f"Bank account status is '{status}'. Only active accounts can be linked. "
            "Please try again or use a different bank account.",
            400,
        )


class BankLinkingIncomplete(BankLinkingError):
    """User closed the modal without completing bank linking."""

    def __init__(self) -> None:
        super().__init__(
            "Bank linking was not completed. Please try again.",
            400,
        )


class MissingBankDetails(BankLinkingError):
    """Bank account details are missing from Financial Connections."""

    def __init__(self) -> None:
        super().__init__(
            "Could not retrieve bank account details. "
            "Please try again or contact support.",
            400,
        )


class BankLinkingService:
    """
    Service for linking bank accounts via Stripe Financial Connections.
    """

    async def create_session(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
        return_url: str,
    ) -> BankLinkingSession:
        """
        Create a Stripe Financial Connections session.

        Args:
            session: Database session
            account_id: Spaire account ID
            return_url: URL to redirect after completion

        Returns:
            BankLinkingSession with client_secret for Stripe.js
        """
        # Verify account exists and is active
        account = await self._get_and_verify_account(session, account_id)

        # Create Financial Connections session
        fc_session = await stripe_service.create_financial_connections_session(
            account_holder_type="account",
            return_url=return_url,
            permissions=["payment_method", "balances", "ownership"],
        )

        log.info(
            "bank_linking.session.created",
            account_id=str(account_id),
            session_id=fc_session.id,
        )

        return BankLinkingSession(
            client_secret=fc_session.client_secret,
            session_id=fc_session.id,
            publishable_key=settings.STRIPE_PUBLISHABLE_KEY,
        )

    async def complete_linking(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
        financial_connections_account_id: str,
    ) -> BankAccountInfo:
        """
        Complete bank linking after user connects their bank.

        This method:
        1. Retrieves account details from Stripe Financial Connections
        2. Verifies the account is active
        3. Extracts routing and account numbers (NEVER logged)
        4. Encrypts and stores bank details
        5. Creates Mercury recipient
        6. Detects RTP eligibility

        Args:
            session: Database session
            account_id: Spaire account ID
            financial_connections_account_id: Stripe FC account ID from modal

        Returns:
            BankAccountInfo with linked bank details and RTP eligibility
        """
        # Verify account
        account = await self._get_and_verify_account(session, account_id)

        # Get Financial Connections account from Stripe
        fc_account = await stripe_service.get_financial_connections_account(
            financial_connections_account_id
        )

        # CRITICAL: Verify account is active
        if fc_account.status != "active":
            log.warning(
                "bank_linking.account_not_active",
                account_id=str(account_id),
                fc_account_id=financial_connections_account_id,
                status=fc_account.status,
            )
            raise FinancialConnectionsAccountNotActive(fc_account.status)

        # Extract bank details (NEVER log these values)
        routing_number = fc_account.routing_number
        account_number = fc_account.account_number

        if not routing_number or not account_number:
            log.error(
                "bank_linking.missing_details",
                account_id=str(account_id),
                fc_account_id=financial_connections_account_id,
                has_routing=bool(routing_number),
                has_account=bool(account_number),
            )
            raise MissingBankDetails()

        # Determine account type
        account_type = "checking"
        if fc_account.subcategory == "savings":
            account_type = "savings"

        # Get bank name from institution
        bank_name = None
        if fc_account.institution_name:
            bank_name = fc_account.institution_name

        # Store encrypted bank details
        bank_details = await account_bank_details.create_from_stripe_financial_connections(
            session,
            account=account,
            routing_number=routing_number,
            account_number=account_number,
            account_type=account_type,
            bank_name=bank_name,
            stripe_financial_connection_id=financial_connections_account_id,
        )

        # Check RTP eligibility based on routing number
        is_rtp_eligible = self._check_rtp_eligibility(routing_number)

        # Create Mercury recipient (if Mercury is enabled)
        mercury_recipient_id = None
        if settings.MERCURY_PAYOUTS_ENABLED:
            try:
                account_name = account.billing_name or "Unknown"
                mercury_recipient_id = await mercury_service.ensure_recipient_exists(
                    session, bank_details, account_name
                )
            except Exception as e:
                # Log but don't fail - Mercury recipient can be created later
                log.warning(
                    "bank_linking.mercury_recipient_failed",
                    account_id=str(account_id),
                    error=str(e),
                )

        # Update account payout provider to Mercury if enabled
        if settings.MERCURY_PAYOUTS_ENABLED:
            account_repository = AccountRepository.from_session(session)
            await account_repository.update(
                account, update_dict={"payout_provider": "mercury"}
            )

        log.info(
            "bank_linking.completed",
            account_id=str(account_id),
            bank_name=bank_name,
            account_type=account_type,
            is_rtp_eligible=is_rtp_eligible,
            mercury_recipient_created=bool(mercury_recipient_id),
            # SECURITY: Only log last 4 digits
            routing_last4=get_last4(routing_number),
            account_last4=get_last4(account_number),
        )

        return BankAccountInfo(
            id=bank_details.id,
            account_id=account_id,
            bank_name=bank_name,
            account_type=account_type,
            account_number_last4=bank_details.account_number_last4,
            routing_number_last4=get_last4(routing_number),
            verified_at=bank_details.verified_at,
            is_rtp_eligible=is_rtp_eligible,
            mercury_recipient_id=mercury_recipient_id,
        )

    async def get_status(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
    ) -> BankLinkingStatus:
        """
        Get bank linking status for an account.

        Args:
            session: Database session
            account_id: Spaire account ID

        Returns:
            BankLinkingStatus with linked bank info and readiness status
        """
        # Verify account exists
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(account_id)
        if account is None:
            raise AccountNotFound(account_id)

        # Get bank details
        bank_details = await account_bank_details.get_by_account(session, account_id)

        if bank_details is None:
            return BankLinkingStatus(
                has_linked_bank=False,
                bank_account=None,
                is_rtp_eligible=False,
                is_mercury_ready=False,
            )

        # Get routing number for RTP check
        routing_number = decrypt_string(bank_details.routing_number_encrypted)
        is_rtp_eligible = self._check_rtp_eligibility(routing_number)

        bank_account = BankAccountInfo(
            id=bank_details.id,
            account_id=account_id,
            bank_name=bank_details.bank_name,
            account_type=bank_details.account_type.value,
            account_number_last4=bank_details.account_number_last4,
            routing_number_last4=get_last4(routing_number),
            verified_at=bank_details.verified_at,
            is_rtp_eligible=is_rtp_eligible,
            mercury_recipient_id=bank_details.mercury_recipient_id,
        )

        return BankLinkingStatus(
            has_linked_bank=True,
            bank_account=bank_account,
            is_rtp_eligible=is_rtp_eligible,
            is_mercury_ready=bool(bank_details.mercury_recipient_id),
        )

    async def disconnect(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
    ) -> None:
        """
        Disconnect a linked bank account.

        Args:
            session: Database session
            account_id: Spaire account ID
        """
        # Get bank details
        bank_details = await account_bank_details.get_by_account(session, account_id)
        if bank_details is None:
            return  # No bank linked, nothing to do

        # Disconnect from Stripe if we have the FC account ID
        if bank_details.stripe_financial_connection_id:
            try:
                await stripe_service.disconnect_financial_connections_account(
                    bank_details.stripe_financial_connection_id
                )
            except Exception as e:
                log.warning(
                    "bank_linking.stripe_disconnect_failed",
                    account_id=str(account_id),
                    error=str(e),
                )

        # Soft delete bank details
        await account_bank_details.delete(session, bank_details)

        log.info(
            "bank_linking.disconnected",
            account_id=str(account_id),
        )

    def _check_rtp_eligibility(self, routing_number: str) -> bool:
        """
        Check if routing number supports Real-Time Payments.

        Mercury-native routing numbers (Column N.A., Choice Financial)
        support instant RTP transfers.
        """
        return routing_number in settings.MERCURY_NATIVE_ROUTING_NUMBERS

    async def _get_and_verify_account(
        self, session: AsyncSession, account_id: UUID
    ) -> Account:
        """Get account and verify it's in active status."""
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(account_id)

        if account is None:
            raise AccountNotFound(account_id)

        if not account.is_active():
            raise AccountNotActive(account)

        return account


# Singleton instance
bank_linking = BankLinkingService()
