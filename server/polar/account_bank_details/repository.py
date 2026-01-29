"""Repository for AccountBankDetails."""

from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.account_bank_details import AccountBankDetails


class AccountBankDetailsRepository(
    RepositorySoftDeletionIDMixin[AccountBankDetails, UUID],
    RepositorySoftDeletionMixin[AccountBankDetails],
    RepositoryBase[AccountBankDetails],
):
    """Repository for AccountBankDetails operations."""

    model = AccountBankDetails

    async def get_by_account_id(self, account_id: UUID) -> AccountBankDetails | None:
        """Get active bank details for an account."""
        statement = self.get_base_statement().where(
            AccountBankDetails.account_id == account_id,
        )
        return await self.get_one_or_none(statement)

    async def get_by_mercury_recipient_id(
        self, mercury_recipient_id: str
    ) -> AccountBankDetails | None:
        """Get bank details by Mercury recipient ID."""
        statement = self.get_base_statement().where(
            AccountBankDetails.mercury_recipient_id == mercury_recipient_id,
        )
        return await self.get_one_or_none(statement)
