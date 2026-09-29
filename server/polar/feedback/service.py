from polar.auth.models import AuthSubject
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.models import Feedback, User
from polar.models.feedback import FeedbackType
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .repository import FeedbackRepository
from .schemas import FeedbackCreate


class FeedbackError(PolarError): ...


class FeedbackService:
    async def submit(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        create_schema: FeedbackCreate,
    ) -> Feedback:
        user = auth_subject.subject

        membership = await user_organization_service.get_by_user_and_org(
            session, user.id, create_schema.organization_id
        )
        out_of_scope = (
            auth_subject.organization_ids is not None
            and create_schema.organization_id not in auth_subject.organization_ids
        )
        if membership is None or out_of_scope:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "organization_id"),
                        "msg": "User is not a member of this organization.",
                        "input": create_schema.organization_id,
                    }
                ]
            )

        repository = FeedbackRepository.from_session(session)
        feedback = await repository.create(
            Feedback(
                type=create_schema.type,
                message=create_schema.message,
                client_context=create_schema.client_context,
                user=membership.user,
                organization=membership.organization,
            ),
            flush=True,
        )

        # Questions automatically open a Plain support thread, impersonating the
        # customer with their message and attaching the conversation transcript.
        if feedback.type == FeedbackType.question:
            enqueue_job("feedback.reply_in_plain", feedback_id=feedback.id)

        return feedback


feedback = FeedbackService()
