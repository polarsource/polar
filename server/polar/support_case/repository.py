from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository.base import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCase,
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

    async def has_message_of_type(self, case_id: UUID, types: Sequence[str]) -> bool:
        statement = (
            self.get_base_statement()
            .where(
                SupportCaseMessage.case_id == case_id,
                SupportCaseMessage.type.in_(types),
            )
            .limit(1)
        )
        return await self.get_one_or_none(statement) is not None


class SupportCaseParticipantRepository(
    RepositorySoftDeletionIDMixin[SupportCaseParticipant, UUID],
    RepositorySoftDeletionMixin[SupportCaseParticipant],
    RepositoryBase[SupportCaseParticipant],
):
    model = SupportCaseParticipant


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
