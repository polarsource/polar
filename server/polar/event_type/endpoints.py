from fastapi import Depends

from polar.event_type import auth, schemas
from polar.event_type.service import event_type_service
from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

router = APIRouter(prefix="/event_types", tags=["event_types", APITag.public])


@router.patch(
    "/{id}",
    response_model=schemas.EventType,
    summary="Update Event Type",
    description="Update an event type's label.",
    status_code=200,
    responses={404: {}},
)
async def update_event_type(
    id: schemas.EventTypeID,
    body: schemas.EventTypeUpdate,
    auth_subject: auth.EventTypeWrite,
    session: AsyncSession = Depends(get_db_session),
) -> schemas.EventType:
    event_type = await event_type_service.get(session, auth_subject, id)
    if event_type is None:
        raise ResourceNotFound()

    updated_event_type = await event_type_service.update(
        session, event_type, body.label
    )
    return schemas.EventType.model_validate(updated_event_type)
