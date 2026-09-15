from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends

from polar.exceptions import ResourceNotFound
from polar.models import VoidReducer
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.void.auth import VoidRead, VoidWrite

from .exceptions import InvalidReducer
from .schemas import Reducer, ReducerCreate, ReducerRecord
from .service import ReducerNotDict, SlugTaken
from .service import reducer as reducer_service

router = APIRouter(prefix="/reducers", tags=["reducers"], include_in_schema=False)


@router.get("", response_model=list[Reducer], operation_id="reducers:list")
async def list_reducers(
    auth_subject: VoidRead, session: AsyncReadSession = Depends(get_db_read_session)
) -> Sequence[VoidReducer]:
    return await reducer_service.list(session, auth_subject.subject.id)


@router.post(
    "",
    response_model=Reducer,
    status_code=201,
    operation_id="reducers:create",
    responses={
        400: {"model": InvalidReducer.schema()},
        409: {"model": SlugTaken.schema()},
    },
)
async def create_reducer(
    body: ReducerCreate,
    auth_subject: VoidWrite,
    session: AsyncSession = Depends(get_db_session),
) -> VoidReducer:
    return await reducer_service.create(session, auth_subject.subject.id, body)


@router.get(
    "/{id}",
    response_model=Reducer,
    operation_id="reducers:get",
    responses={404: {"model": ResourceNotFound.schema()}},
)
async def get_reducer(
    id: UUID,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> VoidReducer:
    return await reducer_service.get(session, auth_subject.subject.id, id)


@router.get(
    "/{id}/records",
    response_model=list[ReducerRecord],
    operation_id="reducers:records",
    responses={
        400: {"model": ReducerNotDict.schema()},
        404: {"model": ResourceNotFound.schema()},
    },
)
async def records(
    id: UUID,
    auth_subject: VoidRead,
    session: AsyncReadSession = Depends(get_db_read_session),
    external_identity_id: str | None = None,
) -> Sequence[ReducerRecord]:
    return await reducer_service.records(
        session, auth_subject.subject.id, id, external_identity_id
    )
