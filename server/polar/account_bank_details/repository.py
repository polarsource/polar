"""Repository for AccountBankDetails."""

from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RecordRepository
from polar.models.account_bank_details import AccountBankDetails


class AccountBankDetailsRepository(RecordRepository[AccountBankDetails]):
    """Repository for AccountBankDetails operations."""

    model = AccountBankDetails

    async def get_by_account_id(self, account_id: UUID) -> AccountBankDetails | None:
        """Get active bank details for an account."""
        statement = select(AccountBankDetails).where(
            AccountBankDetails.account_id == account_id,
            AccountBankDetails.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_mercury_recipient_id(
        self, mercury_recipient_id: str
    ) -> AccountBankDetails | None:
        """Get bank details by Mercury recipient ID."""
        statement = select(AccountBankDetails).where(
            AccountBankDetails.mercury_recipient_id == mercury_recipient_id,
            AccountBankDetails.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()
