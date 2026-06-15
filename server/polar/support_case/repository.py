from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, select
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
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
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

    @staticmethod
    def _merchant_participant_exists(organization_id: UUID) -> ColumnElement[bool]:
        """An organization is the merchant on the enclosing case (live row)."""
        return (
            select(SupportCaseParticipant.id)
            .where(
                SupportCaseParticipant.case_id == SupportCase.id,
                SupportCaseParticipant.kind == SupportCaseParticipantKind.merchant,
                SupportCaseParticipant.organization_id == organization_id,
                SupportCaseParticipant.deleted_at.is_(None),
            )
            .exists()
        )

    async def get_org_case(
        self, organization_id: UUID, case_id: UUID
    ) -> SupportCase | None:
        """A case by id, scoped to an org via its merchant participant.

        Type-agnostic ownership gate: returns the concrete polymorphic subclass
        only when the org is a live merchant participant of the case.
        """
        statement = (
            self.get_base_statement()
            .where(SupportCase.id == case_id)
            .where(self._merchant_participant_exists(organization_id))
        )
        return await self.get_one_or_none(statement)

    def get_org_cases_statement(
        self, organization_id: UUID
    ) -> Select[tuple[SupportCase, bool, bool, datetime | None]]:
        """All cases (any type) an org participates in, with derived columns,
        ordered by most recent externally-visible activity."""
        last_message_at = (
            select(func.max(SupportCaseMessage.created_at))
            .where(
                SupportCaseMessage.case_id == SupportCase.id,
                func.cardinality(SupportCaseMessage.audience) > 0,
            )
            .scalar_subquery()
        )
        return (
            self.get_base_statement()
            .where(self._merchant_participant_exists(organization_id))
            .add_columns(
                SupportCaseMessageRepository.is_open_expression().label("is_open"),
                SupportCaseMessageRepository.awaiting_platform_expression().label(
                    "awaiting_platform"
                ),
                last_message_at.label("last_message_at"),
            )
            .order_by(
                last_message_at.desc().nulls_last(),
                SupportCase.created_at.desc(),
            )
        )


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

    @staticmethod
    def awaiting_platform_expression() -> ColumnElement[bool]:
        """True when the latest externally-visible message wasn't sent by our
        side — i.e. a participant spoke last and the platform owes a reply.
        Defined by exclusion (not ``platform``/``system``) so it stays correct
        for any participant kind. Internal notes and lifecycle events (empty
        audience) are ignored, so they don't clear it.
        """
        latest_author = (
            select(SupportCaseMessage.author_kind)
            .where(
                SupportCaseMessage.case_id == SupportCase.id,
                func.cardinality(SupportCaseMessage.audience) > 0,
            )
            .order_by(SupportCaseMessage.created_at.desc())
            .limit(1)
            .scalar_subquery()
        )
        return latest_author.notin_(
            [
                SupportCaseMessageAuthorKind.platform,
                SupportCaseMessageAuthorKind.system,
            ]
        )


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
