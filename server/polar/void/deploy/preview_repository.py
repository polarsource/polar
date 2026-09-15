from datetime import datetime

from sqlalchemy import func, select

from polar.kit.repository import RepositoryBase
from polar.models import VoidReducer, VoidReducerBucket


class PreviewRepository(RepositoryBase[VoidReducerBucket]):
    model = VoidReducerBucket

    async def buckets(
        self, reducer: VoidReducer, external_id: str, end: datetime, *, actor: bool
    ) -> list[tuple[datetime, float]]:
        identity = (
            VoidReducerBucket.external_identity_id
            if actor
            else VoidReducerBucket.external_root_id
        )
        rows = await self.session.execute(
            select(VoidReducerBucket.bucket_start, func.sum(VoidReducerBucket.value))
            .where(
                VoidReducerBucket.organization_id == reducer.organization_id,
                VoidReducerBucket.reducer_id == reducer.id,
                VoidReducerBucket.deleted_at.is_(None),
                VoidReducerBucket.bucket_start < end,
                identity == external_id,
            )
            .group_by(VoidReducerBucket.bucket_start)
            .order_by(VoidReducerBucket.bucket_start)
        )
        return [(timestamp, value or 0) for timestamp, value in rows]
