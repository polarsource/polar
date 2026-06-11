from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import ColumnElement, select
from sqlalchemy.orm import joinedload

from polar.kit.repository.base import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCase,
    SupportCaseAttachment,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageType,
    SupportCaseParticipant,
)

# Message types whose latest occurrence determines the open/closed state.
_LIFECYCLE_TYPES = (
    SupportCaseMessageType.opened,
    SupportCaseMessageType.closed,
)


class SupportCaseRepository(
    RepositorySoftDeletionIDMixin[SupportCase, UUID],
    RepositorySoftDeletionMixin[SupportCase],
    RepositoryBase[SupportCase],
):
    model = SupportCase


class SupportCaseMessageRepository(
    RepositorySoftDeletionIDMixin[SupportCaseMessage, UUID],
    RepositorySoftDeletionMixin[SupportCaseMessage],
    RepositoryBase[SupportCaseMessage],
):
    model = SupportCaseMessage

    async def list_by_case(
        self, case_id: UUID, *, visible_to: SupportCaseAudience | None = None
    ) -> Sequence[SupportCaseMessage]:
        """A case's messages in chronological order (oldest first).

        ``visible_to`` filters by audience for a non-platform reader (merchant
        or customer). Pass ``None`` for the platform, which sees everything —
        including internal notes (``audience == []``).
        """
        statement = (
            self.get_base_statement()
            .where(SupportCaseMessage.case_id == case_id)
            .order_by(SupportCaseMessage.created_at.asc())
        )
        if visible_to is not None:
            statement = statement.where(
                SupportCaseMessage.audience.contains([visible_to])
            )
        return await self.get_all(statement)

    async def get_latest_lifecycle_event(
        self, case_id: UUID
    ) -> SupportCaseMessage | None:
        statement = (
            self.get_base_statement()
            .where(
                SupportCaseMessage.case_id == case_id,
                SupportCaseMessage.type.in_(_LIFECYCLE_TYPES),
            )
            .order_by(SupportCaseMessage.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def is_open(self, case_id: UUID) -> bool:
        latest = await self.get_latest_lifecycle_event(case_id)
        assert latest is not None  # always created with an `opened` event
        return latest.type != SupportCaseMessageType.closed

    @staticmethod
    def is_open_expression() -> ColumnElement[bool]:
        """SQL form of ``is_open()``, correlated to the enclosing case row.
        State is the type of the latest lifecycle event
        Lets a list query derive open/closed in one pass instead of
        an N+1 of per-case ``is_open()`` calls.
        """
        latest_type = (
            select(SupportCaseMessage.type)
            .where(
                SupportCaseMessage.case_id == SupportCase.id,
                SupportCaseMessage.type.in_(_LIFECYCLE_TYPES),
            )
            .order_by(SupportCaseMessage.created_at.desc())
            .limit(1)
            .scalar_subquery()
        )
        return latest_type != SupportCaseMessageType.closed


class SupportCaseParticipantRepository(
    RepositorySoftDeletionIDMixin[SupportCaseParticipant, UUID],
    RepositorySoftDeletionMixin[SupportCaseParticipant],
    RepositoryBase[SupportCaseParticipant],
):
    model = SupportCaseParticipant


class SupportCaseAttachmentRepository(
    RepositorySoftDeletionIDMixin[SupportCaseAttachment, UUID],
    RepositorySoftDeletionMixin[SupportCaseAttachment],
    RepositoryBase[SupportCaseAttachment],
):
    model = SupportCaseAttachment

    async def list_by_case(
        self, case_id: UUID, *, visible_to: SupportCaseAudience | None = None
    ) -> Sequence[SupportCaseAttachment]:
        """A case's attachments (oldest first) with their file eager-loaded.

        ``visible_to`` filters by audience for a non-platform reader; ``None``
        is the platform, which sees everything (mirrors the message repository).
        """
        statement = (
            self.get_base_statement()
            .where(SupportCaseAttachment.case_id == case_id)
            .options(joinedload(SupportCaseAttachment.file))
            .order_by(SupportCaseAttachment.created_at.asc())
        )
        if visible_to is not None:
            statement = statement.where(
                SupportCaseAttachment.audience.contains([visible_to])
            )
        return await self.get_all(statement)

    async def get_by_id_for_case(
        self, attachment_id: UUID, case_id: UUID
    ) -> SupportCaseAttachment | None:
        """An attachment scoped to its case, with its file eager-loaded."""
        statement = (
            self.get_base_statement()
            .where(
                SupportCaseAttachment.id == attachment_id,
                SupportCaseAttachment.case_id == case_id,
            )
            .options(joinedload(SupportCaseAttachment.file))
        )
        return await self.get_one_or_none(statement)


class ReviewAppealSupportCaseRepository(
    RepositorySoftDeletionIDMixin[ReviewAppealSupportCase, UUID],
    RepositorySoftDeletionMixin[ReviewAppealSupportCase],
    RepositoryBase[ReviewAppealSupportCase],
):
    model = ReviewAppealSupportCase

    async def get_by_organization_review(
        self, organization_review_id: UUID
    ) -> ReviewAppealSupportCase | None:
        statement = self.get_base_statement().where(
            ReviewAppealSupportCase.organization_review_id == organization_review_id
        )
        return await self.get_one_or_none(statement)
