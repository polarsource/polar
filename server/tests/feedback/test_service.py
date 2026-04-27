import pytest

from polar.auth.models import AuthSubject
from polar.exceptions import PolarRequestValidationError
from polar.feedback.schemas import FeedbackCreate
from polar.feedback.service import feedback as feedback_service
from polar.models import Organization, User, UserOrganization
from polar.models.feedback import FeedbackType
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture


def _build_payload(
    organization: Organization,
    *,
    type: FeedbackType = FeedbackType.bug,
    message: str = "Something is broken in the dashboard.",
) -> FeedbackCreate:
    return FeedbackCreate(
        type=type,
        message=message,
        organization_id=organization.id,
        client_context={"url": "https://polar.sh/dashboard"},
    )


@pytest.mark.asyncio
class TestSubmit:
    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_member_can_submit(
        self,
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        auth_subject: AuthSubject[User],
    ) -> None:
        feedback = await feedback_service.submit(
            session, auth_subject, _build_payload(organization)
        )

        assert feedback.id is not None
        assert feedback.user_id == auth_subject.subject.id
        assert feedback.organization_id == organization.id
        assert feedback.type == FeedbackType.bug
        assert feedback.client_context == {"url": "https://polar.sh/dashboard"}

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
    async def test_non_member_is_rejected(
        self,
        session: AsyncSession,
        organization: Organization,
        auth_subject: AuthSubject[User],
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await feedback_service.submit(
                session, auth_subject, _build_payload(organization)
            )
