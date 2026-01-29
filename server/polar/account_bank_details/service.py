"""
Service for managing account bank details.

Handles:
- Creating bank details from Stripe Financial Connections
- Encrypting/decrypting sensitive bank information
- Integration with Mercury recipients
"""

from datetime import datetime
from uuid import UUID

import structlog

from polar.kit.crypto import decrypt_string, encrypt_string, get_last4
from polar.kit.utils import generate_uuid, utc_now
from polar.logging import Logger
from polar.models.account import Account
from polar.models.account_bank_details import (
    AccountBankDetails,
    BankAccountType,
    VerificationMethod,
)
from polar.postgres import AsyncSession

from .repository import AccountBankDetailsRepository

log: Logger = structlog.get_logger()


class BankDetailsError(Exception):
    """Base exception for bank details operations."""

    pass


class BankDetailsAlreadyExists(BankDetailsError):
    """Bank details already exist for this account."""

    pass


class BankDetailsNotFound(BankDetailsError):
    """Bank details not found for this account."""

    pass


class AccountBankDetailsService:
    """
    Service for managing encrypted bank account details.
    """

    async def create_from_stripe_financial_connections(
        self,
        session: AsyncSession,
        *,
        account: Account,
        routing_number: str,
        account_number: str,
        account_type: str,
        bank_name: str | None = None,
        stripe_financial_connection_id: str,
    ) -> AccountBankDetails:
        """
        Create bank details from Stripe Financial Connections verification.

        This is called after a user completes the Financial Connections flow
        during onboarding.

        Args:
            session: Database session
            account: The Spaire account
            routing_number: 9-digit ABA routing number
            account_number: Full bank account number
            account_type: "checking" or "savings"
            bank_name: Optional bank name from Financial Connections
            stripe_financial_connection_id: Stripe Financial Connections account ID

        Returns:
            Created AccountBankDetails
        """
        repository = AccountBankDetailsRepository.from_session(session)

        # Check if bank details already exist
        existing = await repository.get_by_account_id(account.id)
        if existing:
            log.warning(
                "bank_details.already_exists",
                account_id=str(account.id),
                existing_id=str(existing.id),
            )
            # Soft delete existing and create new
            existing.deleted_at = utc_now()
            session.add(existing)

        # Validate and normalize account type
        normalized_account_type = BankAccountType.checking
        if account_type.lower() == "savings":
            normalized_account_type = BankAccountType.savings

        # Encrypt sensitive data
        routing_encrypted = encrypt_string(routing_number)
        account_encrypted = encrypt_string(account_number)
        last4 = get_last4(account_number)

        # Create new bank details
        bank_details = AccountBankDetails(
            id=generate_uuid(),
            account_id=account.id,
            routing_number_encrypted=routing_encrypted,
            account_number_encrypted=account_encrypted,
            account_number_last4=last4,
            account_type=normalized_account_type,
            bank_name=bank_name,
            verification_method=VerificationMethod.stripe_financial_connections,
            verified_at=utc_now(),
            stripe_financial_connection_id=stripe_financial_connection_id,
            created_at=utc_now(),
        )

        session.add(bank_details)
        await session.flush()

        log.info(
            "bank_details.created",
            account_id=str(account.id),
            bank_details_id=str(bank_details.id),
            last4=last4,
            bank_name=bank_name,
            verification_method="stripe_financial_connections",
        )

        return bank_details

    async def get_by_account(
        self, session: AsyncSession, account_id: UUID
    ) -> AccountBankDetails | None:
        """Get active bank details for an account."""
        repository = AccountBankDetailsRepository.from_session(session)
        return await repository.get_by_account_id(account_id)

    async def get_decrypted_routing_number(
        self, bank_details: AccountBankDetails
    ) -> str:
        """Get decrypted routing number."""
        return decrypt_string(bank_details.routing_number_encrypted)

    async def get_decrypted_account_number(
        self, bank_details: AccountBankDetails
    ) -> str:
        """Get decrypted account number."""
        return decrypt_string(bank_details.account_number_encrypted)

    async def update_mercury_recipient(
        self,
        session: AsyncSession,
        bank_details: AccountBankDetails,
        mercury_recipient_id: str,
    ) -> AccountBankDetails:
        """
        Update bank details with Mercury recipient ID.

        Called after successfully creating a Mercury recipient.
        """
        bank_details.mercury_recipient_id = mercury_recipient_id
        bank_details.mercury_recipient_created_at = utc_now()
        session.add(bank_details)
        await session.flush()

        log.info(
            "bank_details.mercury_recipient_updated",
            bank_details_id=str(bank_details.id),
            mercury_recipient_id=mercury_recipient_id,
        )

        return bank_details

    async def delete(
        self, session: AsyncSession, bank_details: AccountBankDetails
    ) -> None:
        """Soft delete bank details."""
        bank_details.deleted_at = utc_now()
        session.add(bank_details)
        await session.flush()

        log.info(
            "bank_details.deleted",
            bank_details_id=str(bank_details.id),
            account_id=str(bank_details.account_id),
        )


# Singleton instance
account_bank_details = AccountBankDetailsService()
