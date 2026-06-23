from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.models import Customer, File
from polar.models.support_case import (
    SupportCase,
    SupportCaseAttachment,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import (
    SupportCaseAttachmentRepository,
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

    async def get(
        self,
        session: AsyncSession | AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        case_id: UUID,
    ) -> SupportCase | None:
        """A case the subject is allowed to read, by id. Org-manage scoped."""
        repository = SupportCaseRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            SupportCase.id == case_id
        )
        return await repository.get_one_or_none(statement)

    async def get_thread(
        self,
        session: AsyncSession | AsyncReadSession,
        case: SupportCase,
        *,
        visible_to: SupportCaseAudience | None,
    ) -> tuple[bool, Sequence[SupportCaseMessage]]:
        """A case's open state and its messages visible to ``visible_to``."""
        message_repository = SupportCaseMessageRepository.from_session(session)
        is_open = await message_repository.is_open(case.id)
        messages = await message_repository.list_by_case(case.id, visible_to=visible_to)
        return is_open, messages

    async def list_attachments(
        self,
        session: AsyncSession | AsyncReadSession,
        case: SupportCase,
        *,
        visible_to: SupportCaseAudience | None,
    ) -> Sequence[SupportCaseAttachment]:
        repository = SupportCaseAttachmentRepository.from_session(session)
        return await repository.list_by_case(case.id, visible_to=visible_to)

    async def get_attachment(
        self,
        session: AsyncSession | AsyncReadSession,
        case: SupportCase,
        attachment_id: UUID,
        *,
        visible_to: SupportCaseAudience | None,
    ) -> SupportCaseAttachment | None:
        repository = SupportCaseAttachmentRepository.from_session(session)
        attachment = await repository.get_by_id_for_case(attachment_id, case.id)
        if attachment is None:
            return None
        if visible_to is not None and visible_to not in attachment.audience:
            return None
        return attachment

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

    async def add_attachment(
        self,
        session: AsyncSession,
        case: SupportCase,
        *,
        file: File,
        message: SupportCaseMessage | None = None,
        audience: Sequence[SupportCaseAudience] = (),
    ) -> SupportCaseAttachment:
        """Attach an uploaded file to a case.

        Pass ``message`` to pin the attachment to a conversational turn — its
        provenance (who/when/role) is that message's. Omit it only for an
        attachment with no conversational author: a file that belongs to the
        case itself (e.g. a system-generated artifact). User uploads always
        carry a message.
        """
        repository = SupportCaseAttachmentRepository.from_session(session)
        return await repository.create(
            SupportCaseAttachment(
                case=case,
                file=file,
                # Set the scalar FK, not a `message=` relationship: the message
                # is reached via the composite (case_id, message_id) FK, whose
                # case_id is already owned by `case` above
                message_id=message.id if message is not None else None,
                audience=list(audience),
            ),
            flush=True,
        )


support_case = SupportCaseService()
