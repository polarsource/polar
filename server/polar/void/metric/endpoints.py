from typing import Annotated

from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter
from polar.void.auth import VoidRead
from polar.void.identity.service import IdentityHierarchyConflict

from .schemas import Metrics, MetricsQuery
from .service import ReducerNotScalar
from .service import metric as metric_service

router = APIRouter(prefix="/metrics", tags=["metrics"], include_in_schema=False)


@router.get(
    "",
    response_model=Metrics,
    operation_id="metrics:get",
    responses={
        400: {"model": ReducerNotScalar.schema()},
        404: {"model": ResourceNotFound.schema()},
        409: {"model": IdentityHierarchyConflict.schema()},
    },
)
async def get_metrics(
    query: Annotated[MetricsQuery, Query()],
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Metrics:
    return await metric_service.get(session, auth_subject.subject.id, query)
