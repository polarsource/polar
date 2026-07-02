from collections.abc import Sequence
from uuid import UUID

from polar.exceptions import PolarError
from polar.models import Dispute, File, Organization, User
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.support_case.repository import (
    DisputeSupportCaseRepository,
    SupportCaseMessageRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.worker import enqueue_job

DISPUTE_GREETING = (
    "Thanks for submitting your response. The Polar team will review your evidence "
    "and submit it to the card network on your behalf. We'll keep you posted "
    "here as the dispute progresses, or reach out if we need more information."
)
# A small delay so the automated greeting doesn't land instantly after the
# merchant's reply (which looks a bit wonky)
DISPUTE_GREETING_DELAY_MS = 2000


class DisputeCaseError(PolarError): ...


class CaseAlreadyExistsError(DisputeCaseError):
    def __init__(self, dispute_id: UUID) -> None:
        super().__init__(f"Dispute {dispute_id} already has a support case.", 409)


class CaseClosedError(DisputeCaseError):
    def __init__(self, case_id: UUID) -> None:
        super().__init__(f"Case {case_id} is closed.", 409)


class DisputeCaseService:
    """Wraps the support-case primitive for chargeback disputes.

    The dispute owns its own state; the case owns the merchant ↔ support thread.
    """

    async def open_case(
        self,
        session: AsyncSession,
        dispute: Dispute,
        *,
        organization: Organization,
    ) -> DisputeSupportCase:
        """Open the support case for a dispute that needs a response.

        Opened by the system (a Stripe webhook), not a human; the merchant is
        added as a participant so they can respond.
        """
        if await self.get_case(session, dispute) is not None:
            raise CaseAlreadyExistsError(dispute.id)

        case = await support_case_service.create(
            session,
            DisputeSupportCase(dispute=dispute, organization=organization),
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )
        await support_case_service.add_participant(
            session,
            case,
            SupportCaseParticipantKind.merchant,
            organization=organization,
        )
        return case

    async def get_case(
        self, session: AsyncSession | AsyncReadSession, dispute: Dispute
    ) -> DisputeSupportCase | None:
        repository = DisputeSupportCaseRepository.from_session(session)
        return await repository.get_by_dispute(dispute.id)

    async def is_open(
        self, session: AsyncSession | AsyncReadSession, case: DisputeSupportCase
    ) -> bool:
        repository = SupportCaseMessageRepository.from_session(session)
        return await repository.is_open(case.id)

    async def reopen(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> SupportCaseMessage:
        """Reopen a closed case when its dispute needs a response again."""
        return await support_case_service.post_message(
            session,
            case,
            type=SupportCaseMessageType.opened,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )

    async def mark_under_review(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> SupportCaseMessage:
        """Record that the dispute's evidence is now under review by the bank."""
        return await support_case_service.post_message(
            session,
            case,
            type=SupportCaseMessageType.dispute_under_review,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )

    async def accept(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> SupportCaseMessage:
        """Record the merchant's acceptance (concede) on the thread.

        A ``system`` lifecycle event, like the other ``dispute_*`` events —
        merchant/platform/customer author kinds are reserved for chat.
        """
        await self._assert_open(session, case)
        return await support_case_service.post_message(
            session,
            case,
            type=SupportCaseMessageType.merchant_accepted,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )

    async def add_reply(
        self,
        session: AsyncSession,
        case: DisputeSupportCase,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        author_user: User | None = None,
        body: str | None = None,
        files: Sequence[File] = (),
        internal: bool = False,
    ) -> SupportCaseMessage:
        """Post a reply to the dispute thread, optionally carrying files.

        This is the merchant ↔ support conversation channel: the merchant's
        evidence and any back-and-forth live here as ``chat`` messages, which
        support reviews and submits to the processor.
        """
        await self._assert_open(session, case)

        is_first_merchant_reply = (
            author_kind == SupportCaseMessageAuthorKind.merchant
            and not await self._has_merchant_message(session, case)
        )

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
        if not internal:
            enqueue_job(
                "support_case.notify_organization_of_new_message",
                message_id=message.id,
            )

        if is_first_merchant_reply:
            enqueue_job(
                "dispute.post_dispute_greeting",
                case_id=case.id,
                delay=DISPUTE_GREETING_DELAY_MS,
            )

        return message

    async def _has_merchant_message(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> bool:
        repository = SupportCaseMessageRepository.from_session(session)
        messages = await repository.list_by_case(case.id, visible_to=None)
        return any(
            message.author_kind == SupportCaseMessageAuthorKind.merchant
            for message in messages
        )

    async def resolve(
        self, session: AsyncSession, case: DisputeSupportCase, *, won: bool
    ) -> SupportCaseMessage:
        """Record the dispute outcome, then close the case."""
        await self._assert_open(session, case)
        await support_case_service.post_message(
            session,
            case,
            type=SupportCaseMessageType.dispute_won
            if won
            else SupportCaseMessageType.dispute_lost,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )
        return await self.close(session, case)

    async def prevent(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> SupportCaseMessage:
        """Record that the chargeback was prevented (refunded before it went
        through), then close the case — the merchant outcome, kept on the
        timeline instead of a silent close."""
        await self._assert_open(session, case)
        await support_case_service.post_message(
            session,
            case,
            type=SupportCaseMessageType.dispute_prevented,
            author_kind=SupportCaseMessageAuthorKind.system,
            audience=[SupportCaseAudience.merchant],
        )
        return await self.close(session, case)

    async def close(
        self,
        session: AsyncSession,
        case: DisputeSupportCase,
        *,
        body: str | None = None,
    ) -> SupportCaseMessage:
        """Close the case once the dispute is resolved (won/lost/prevented)."""
        await self._assert_open(session, case)
        return await support_case_service.close(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.system,
            body=body,
            audience=[SupportCaseAudience.merchant],
        )

    async def _assert_open(
        self, session: AsyncSession, case: DisputeSupportCase
    ) -> None:
        if not await self.is_open(session, case):
            raise CaseClosedError(case.id)


dispute_case = DisputeCaseService()
