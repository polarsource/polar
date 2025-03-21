from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import BillingEntry


class BillingEntryRepository(
    RepositorySoftDeletionIDMixin[BillingEntry, UUID],
    RepositorySoftDeletionMixin[BillingEntry],
    RepositoryBase[BillingEntry],
):
    model = BillingEntry

    async def get_pending_by_subscription(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Sequence[BillingEntry]:
        statement = (
            self.get_base_statement()
            .where(
                BillingEntry.order_item_id.is_(None),
                BillingEntry.subscription_id == subscription_id,
            )
            .order_by(BillingEntry.product_price_id.asc())
            .options(*options)
        )
        return await self.get_all(statement)
