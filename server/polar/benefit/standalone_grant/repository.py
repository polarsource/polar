from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Benefit, BenefitGrant, StandaloneGrant


class StandaloneGrantRepository(
    RepositorySoftDeletionIDMixin[StandaloneGrant, UUID],
    RepositorySoftDeletionMixin[StandaloneGrant],
    RepositoryBase[StandaloneGrant],
):
    model = StandaloneGrant

    def get_eager_options(self) -> Options:
        return (
            selectinload(StandaloneGrant.grants).options(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            ),
        )

    async def list_expired_for_update(
        self,
        now: datetime,
        *,
        limit: int,
    ) -> Sequence[StandaloneGrant]:
        statement = (
            self.get_base_statement()
            .where(
                StandaloneGrant.expires_at.is_not(None),
                StandaloneGrant.expires_at <= now,
                StandaloneGrant.revocation_requested_at.is_(None),
                StandaloneGrant.deleted_at.is_(None),
            )
            .order_by(StandaloneGrant.expires_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
            .options(*self.get_eager_options())
        )
        return await self.get_all(statement)
