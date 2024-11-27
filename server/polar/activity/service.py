from polar.activity.schemas import ActivitySchema
from polar.kit.services import ResourceServiceReader

from .schemas import ActivitySchema


class ActivityService(ResourceServiceReader[ActivitySchema]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject,
        pagination: PaginationParamsQuery,
        sorting: ListSorting,
    ) -> Tuple[List[ActivitySchema], int]:
        query = self._query(session, auth_subject)
        query = query.order_by(*sorting)
        return await paginate_query(query, pagination)
