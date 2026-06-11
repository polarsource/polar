from collections.abc import Sequence
from uuid import UUID

from polar.exceptions import PolarError
from polar.models import Organization, User
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.support_case.repository import (
    ReviewAppealSupportCaseRepository,
    SupportCaseMessageRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.worker import enqueue_job


class AppealCaseError(PolarError): ...


class CaseAlreadyExistsError(AppealCaseError):
    def __init__(self, organization_review_id: UUID) -> None:
        super().__init__(
            f"Review {organization_review_id} already has a human-review case.",
            409,
        )


class CaseClosedError(AppealCaseError):
    def __init__(self, case_id: UUID) -> None:
        super().__init__(f"Case {case_id} is closed.", 409)


class AppealCaseService:
    async def request_human_review(
        self,
        session: AsyncSession,
        review: OrganizationReview,
        *,
        organization: Organization,
        reason: str,
        requested_by_user: User,
    ) -> ReviewAppealSupportCase:
        if await self.get_case(session, review) is not None:
            raise CaseAlreadyExistsError(review.id)

        case = await support_case_service.create(
            session,
            ReviewAppealSupportCase(organization_review_id=review.id),
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user=requested_by_user,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.add_participant(
            session,
            case,
            SupportCaseParticipantKind.merchant,
            organization=organization,
        )
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user=requested_by_user,
            body=reason,
            audience=[SupportCaseAudience.merchant],
        )
        return case

    async def add_reply(
        self,
        session: AsyncSession,
        case: ReviewAppealSupportCase,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        author_user: User | None = None,
        body: str,
        internal: bool = False,
    ) -> SupportCaseMessage:
        await self._assert_open(session, case)
        message = await support_case_service.post_message(
            session,
            case,
            author_kind=author_kind,
            author_user=author_user,
            body=body,
            audience=[] if internal else [SupportCaseAudience.merchant],
        )
        # Visible replies notify the case recipients by email (direct send,
        # bypassing the legacy notification system.
        if not internal:
            enqueue_job(
                "support_case.notify_organization_of_new_message", message_id=message.id
            )
        return message

    async def record_decision(
        self,
        session: AsyncSession,
        case: ReviewAppealSupportCase,
        *,
        approved: bool,
        staff_user: User,
        reason: str | None = None,
    ) -> SupportCaseMessage:
        await self._assert_open(session, case)
        message = await support_case_service.post_message(
            session,
            case,
            type=(
                SupportCaseMessageType.appeal_approved
                if approved
                else SupportCaseMessageType.appeal_denied
            ),
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=staff_user,
            body=reason,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=staff_user,
            audience=[SupportCaseAudience.merchant],
        )
        # Notify the case recipients of the decision (same email path as replies).
        enqueue_job(
            "support_case.notify_organization_of_new_message", message_id=message.id
        )
        # This records the decision on the case only. The caller drives org
        # state: approve via organization.backoffice_approve (built to override
        # a denial after the AI rejected the appeal); deny needs no change, as
        # the org is already denied.
        return message

    async def get_case(
        self, session: AsyncSession | AsyncReadSession, review: OrganizationReview
    ) -> ReviewAppealSupportCase | None:
        repository = ReviewAppealSupportCaseRepository.from_session(session)
        return await repository.get_by_organization_review(review.id)

    async def get_thread(
        self,
        session: AsyncSession | AsyncReadSession,
        review: OrganizationReview,
        *,
        visible_to: SupportCaseAudience | None,
    ) -> tuple[ReviewAppealSupportCase, bool, Sequence[SupportCaseMessage]] | None:
        case = await self.get_case(session, review)
        if case is None:
            return None
        message_repository = SupportCaseMessageRepository.from_session(session)
        is_open = await message_repository.is_open(case.id)
        messages = await message_repository.list_by_case(case.id, visible_to=visible_to)
        return case, is_open, messages

    async def _assert_open(
        self, session: AsyncSession, case: ReviewAppealSupportCase
    ) -> None:
        repository = SupportCaseMessageRepository.from_session(session)
        if not await repository.is_open(case.id):
            raise CaseClosedError(case.id)


appeal_case = AppealCaseService()
