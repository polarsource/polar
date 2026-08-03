from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Benefit, BenefitGrant, ManualGrant


class ManualGrantRepository(
    RepositorySoftDeletionIDMixin[ManualGrant, UUID],
    RepositorySoftDeletionMixin[ManualGrant],
    RepositoryBase[ManualGrant],
):
    model = ManualGrant

    def get_eager_options(self) -> Options:
        return (
            selectinload(ManualGrant.grants).options(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            ),
        )

    async def list_expired_for_update(
        self,
        now: datetime,
        *,
        limit: int,
    ) -> Sequence[ManualGrant]:
        has_active_grant = exists(
            select(BenefitGrant.id).where(
                BenefitGrant.manual_grant_id == ManualGrant.id,
                BenefitGrant.revoked_at.is_(None),
                BenefitGrant.deleted_at.is_(None),
            )
        )
        statement = (
            self.get_base_statement()
            .where(
                ManualGrant.expires_at.is_not(None),
                ManualGrant.expires_at <= now,
                ManualGrant.deleted_at.is_(None),
                has_active_grant,
            )
            .order_by(ManualGrant.expires_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
            .options(*self.get_eager_options())
        )
        return await self.get_all(statement)
