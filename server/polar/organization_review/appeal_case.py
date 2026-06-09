from collections.abc import Sequence
from uuid import UUID

from polar.exceptions import PolarError
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

# A final decision locks the case: no more replies, no reopen.
_FINAL_ACTION_TYPES = (
    SupportCaseMessageType.appeal_approved,
    SupportCaseMessageType.appeal_denied,
)


class AppealCaseError(PolarError): ...


class CaseAlreadyExistsError(AppealCaseError):
    def __init__(self, organization_review_id: UUID) -> None:
        super().__init__(
            f"Review {organization_review_id} already has a human-review case."
        )


class CaseLockedError(AppealCaseError):
    def __init__(self, case_id: UUID) -> None:
        super().__init__(f"Case {case_id} is locked: a final decision was recorded.")


class AppealCaseService:
    async def request_human_review(
        self,
        session: AsyncSession,
        review: OrganizationReview,
        *,
        reason: str,
        requested_by_user_id: UUID,
    ) -> ReviewAppealSupportCase:
        if await self.get_case(session, review) is not None:
            raise CaseAlreadyExistsError(review.id)

        case = await support_case_service.create(
            session,
            ReviewAppealSupportCase(organization_review_id=review.id),
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user_id=requested_by_user_id,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.add_participant(
            session,
            case,
            SupportCaseParticipantKind.merchant,
            organization_id=review.organization_id,
        )
        await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            author_user_id=requested_by_user_id,
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
        author_user_id: UUID | None = None,
        body: str,
        internal: bool = False,
    ) -> SupportCaseMessage:
        await self._assert_not_locked(session, case)
        return await support_case_service.post_message(
            session,
            case,
            author_kind=author_kind,
            author_user_id=author_user_id,
            body=body,
            audience=[] if internal else [SupportCaseAudience.merchant],
        )

    async def record_decision(
        self,
        session: AsyncSession,
        case: ReviewAppealSupportCase,
        *,
        approved: bool,
        staff_user_id: UUID,
        reason: str | None = None,
    ) -> SupportCaseMessage:
        await self._assert_not_locked(session, case)
        message = await support_case_service.post_message(
            session,
            case,
            type=(
                SupportCaseMessageType.appeal_approved
                if approved
                else SupportCaseMessageType.appeal_denied
            ),
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user_id=staff_user_id,
            body=reason,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user_id=staff_user_id,
            audience=[SupportCaseAudience.merchant],
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

    async def _assert_not_locked(
        self, session: AsyncSession, case: ReviewAppealSupportCase
    ) -> None:
        repository = SupportCaseMessageRepository.from_session(session)
        if await repository.has_message_of_type(case.id, _FINAL_ACTION_TYPES):
            raise CaseLockedError(case.id)


appeal_case = AppealCaseService()
