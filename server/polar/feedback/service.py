from polar.auth.models import AuthSubject
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.db.postgres import AsyncSession
from polar.models import Feedback, User
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

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
        if membership is None:
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
        return await repository.create(
            Feedback(
                type=create_schema.type,
                message=create_schema.message,
                client_context=create_schema.client_context,
                user=membership.user,
                organization=membership.organization,
            ),
            flush=True,
        )


feedback = FeedbackService()
