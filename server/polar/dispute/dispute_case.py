from uuid import UUID

from polar.exceptions import PolarError
from polar.models import Dispute, Organization
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
            DisputeSupportCase(dispute_id=dispute.id),
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
