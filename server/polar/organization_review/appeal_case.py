from collections.abc import Sequence
from uuid import UUID

from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError
from polar.models import File, Organization, User
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

HUMAN_REVIEW_GREETING = (
    "Thanks for reaching out! Our team will review your appeal and get back to "
    "you within 1–2 business days."
)

# Add a small delay to the automated greeting message
# so it doesn't appear instantly (which looks a bit wonky)
HUMAN_REVIEW_GREETING_DELAY_MS = 1500
APPEAL_CASE_UPDATED_EVENT = "appeal_case.updated"


async def publish_appeal_update(organization_id: UUID) -> None:
    await eventstream_publish(
        APPEAL_CASE_UPDATED_EVENT, {}, organization_id=organization_id
    )


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


class AppealNotRejectedError(AppealCaseError):
    def __init__(self, organization_review_id: UUID) -> None:
        super().__init__(
            f"Review {organization_review_id} has no rejected appeal to escalate "
            "to human review.",
            409,
        )


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
        # A human-review case only makes sense once the AI rejected the appeal.
        # The frontend gates on this; enforce it here too so a direct API call
        # can't open a case while the appeal is pending or approved.
        if review.appeal_decision != OrganizationReview.AppealDecision.REJECTED:
            raise AppealNotRejectedError(review.id)
        if await self.get_case(session, review) is not None:
            raise CaseAlreadyExistsError(review.id)

        case = await support_case_service.create(
            session,
            ReviewAppealSupportCase(
                organization_review=review, organization=organization
            ),
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
        await publish_appeal_update(organization.id)
        enqueue_job(
            "organization_review.post_appeal_greeting",
            case_id=case.id,
            delay=HUMAN_REVIEW_GREETING_DELAY_MS,
        )
        return case

    async def add_reply(
        self,
        session: AsyncSession,
        case: ReviewAppealSupportCase,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        author_user: User | None = None,
        body: str | None = None,
        files: Sequence[File] = (),
        internal: bool = False,
    ) -> SupportCaseMessage:
        """Post a reply, optionally carrying one or more uploaded files."""
        await self._assert_open(session, case)
        audience = [] if internal else [SupportCaseAudience.merchant]
        message = await support_case_service.post_message(
            session,
            case,
            author_kind=author_kind,
            author_user=author_user,
            body=body,
            audience=audience,
        )
        for file in files:
            await support_case_service.add_attachment(
                session, case, file=file, message=message, audience=audience
            )
        # Visible replies notify the case recipients by email (direct send,
        # bypassing the legacy notification system).
        if not internal:
            enqueue_job(
                "support_case.notify_organization_of_new_message",
                message_id=message.id,
            )
            await publish_appeal_update(case.organization_id)
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
        await publish_appeal_update(case.organization_id)
        # This records the decision on the case only. The caller drives org
        # state: approve goes through organization.backoffice_approve, which
        # closes the case via approve_open_case; deny needs no org change, as
        # the org is already denied.
        return message

    async def approve_open_case(
        self,
        session: AsyncSession,
        review: OrganizationReview,
        *,
        staff_user: User,
        reason: str | None = None,
    ) -> SupportCaseMessage | None:
        """Close the review's appeal case as approved, if one is open."""
        return await self._decide_open_case(
            session, review, approved=True, staff_user=staff_user, reason=reason
        )

    async def deny_open_case(
        self,
        session: AsyncSession,
        review: OrganizationReview,
        *,
        staff_user: User,
        reason: str | None = None,
    ) -> SupportCaseMessage | None:
        """Close the review's appeal case as denied, if one is open."""
        return await self._decide_open_case(
            session, review, approved=False, staff_user=staff_user, reason=reason
        )

    async def _decide_open_case(
        self,
        session: AsyncSession,
        review: OrganizationReview,
        *,
        approved: bool,
        staff_user: User,
        reason: str | None = None,
    ) -> SupportCaseMessage | None:
        """Record an appeal decision on the review's case and close it, if a
        case is open. No-op when there's no case or it is already closed, so any
        approve/deny path can call it idempotently to keep the case in sync.
        """
        case = await self.get_case(session, review)
        if case is None:
            return None
        message_repository = SupportCaseMessageRepository.from_session(session)
        if not await message_repository.is_open(case.id):
            return None
        return await self.record_decision(
            session, case, approved=approved, staff_user=staff_user, reason=reason
        )

    async def close_for_organization_deletion(
        self, session: AsyncSession, review: OrganizationReview
    ) -> SupportCaseMessage | None:
        """Close the review's appeal case when its organization is deleted.

        A silent, internal lifecycle close (system author, no decision, no
        merchant email) — the merchant is gone, so the case should stop sitting
        open in the backoffice. No-op when there's no case or it's already
        closed.
        """
        case = await self.get_case(session, review)
        if case is None:
            return None
        message_repository = SupportCaseMessageRepository.from_session(session)
        if not await message_repository.is_open(case.id):
            return None
        return await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.system,
            body="Organization deleted.",
            audience=[],
        )

    async def get_case(
        self, session: AsyncSession | AsyncReadSession, review: OrganizationReview
    ) -> ReviewAppealSupportCase | None:
        repository = ReviewAppealSupportCaseRepository.from_session(session)
        return await repository.get_by_organization_review(review.id)

    async def _assert_open(
        self, session: AsyncSession, case: ReviewAppealSupportCase
    ) -> None:
        repository = SupportCaseMessageRepository.from_session(session)
        if not await repository.is_open(case.id):
            raise CaseClosedError(case.id)


appeal_case = AppealCaseService()
