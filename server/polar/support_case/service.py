from collections.abc import Sequence

from polar.models import Customer, Organization, User
from polar.models.support_case import (
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncSession

from .repository import (
    SupportCaseMessageRepository,
    SupportCaseParticipantRepository,
    SupportCaseRepository,
)


class SupportCaseService:
    async def create[CaseT: SupportCase](
        self,
        session: AsyncSession,
        case: CaseT,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        author_user: User | None = None,
        audience: Sequence[SupportCaseAudience] = (),
    ) -> CaseT:
        """Persist a (typed) case and emit its ``opened`` event atomically."""
        repository = SupportCaseRepository.from_session(session)
        await repository.create(case, flush=True)
        await self.post_message(
            session,
            case,
            type=SupportCaseMessageType.opened,
            author_kind=author_kind,
            author_user=author_user,
            audience=audience,
        )
        return case

    async def add_participant(
        self,
        session: AsyncSession,
        case: SupportCase,
        kind: SupportCaseParticipantKind,
        *,
        organization: Organization | None = None,
        platform_user: User | None = None,
        customer: Customer | None = None,
    ) -> SupportCaseParticipant:
        repository = SupportCaseParticipantRepository.from_session(session)
        return await repository.create(
            SupportCaseParticipant(
                case=case,
                kind=kind,
                organization=organization,
                platform_user=platform_user,
                customer=customer,
            ),
            flush=True,
        )

    async def post_message(
        self,
        session: AsyncSession,
        case: SupportCase,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        type: SupportCaseMessageType = SupportCaseMessageType.chat,
        author_user: User | None = None,
        body: str | None = None,
        audience: Sequence[SupportCaseAudience] = (),
    ) -> SupportCaseMessage:
        repository = SupportCaseMessageRepository.from_session(session)
        return await repository.create(
            SupportCaseMessage(
                case=case,
                type=type,
                author_kind=author_kind,
                author_user=author_user,
                body=body,
                audience=list(audience),
            ),
            flush=True,
        )

    async def close(
        self,
        session: AsyncSession,
        case: SupportCase,
        *,
        author_kind: SupportCaseMessageAuthorKind,
        author_user: User | None = None,
        body: str | None = None,
        audience: Sequence[SupportCaseAudience] = (),
    ) -> SupportCaseMessage:
        return await self.post_message(
            session,
            case,
            type=SupportCaseMessageType.closed,
            author_kind=author_kind,
            author_user=author_user,
            body=body,
            audience=audience,
        )

    async def assign(
        self,
        session: AsyncSession,
        case: SupportCase,
        *,
        assignee: User,
    ) -> SupportCaseMessage:
        """Set the case's current owner and record an internal event.

        Advisory: overwrites any existing assignee without checking for one.
        """
        case.assigned_user = assignee
        return await self.post_message(
            session,
            case,
            type=SupportCaseMessageType.assigned,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=assignee,
        )

    async def unassign(
        self,
        session: AsyncSession,
        case: SupportCase,
        *,
        actor: User,
    ) -> SupportCaseMessage:
        """Clear the case's owner and record an internal event."""
        case.assigned_user = None
        return await self.post_message(
            session,
            case,
            type=SupportCaseMessageType.released,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=actor,
        )


support_case = SupportCaseService()
