from fastapi import Depends

from polar.auth.dependencies import WebUserWrite
from polar.kit.db.postgres import AsyncSession
from polar.models import Feedback as FeedbackModel
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .schemas import Feedback, FeedbackCreate
from .service import feedback as feedback_service

router = APIRouter(prefix="/feedbacks", tags=["feedbacks", APITag.private])


@router.post("/", response_model=Feedback, status_code=201)
async def submit(
    create_schema: FeedbackCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FeedbackModel:
    return await feedback_service.submit(session, auth_subject, create_schema)
