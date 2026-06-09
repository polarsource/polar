from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models.organization_review import OrganizationReview


class SupportCaseType(StrEnum):
    review_appeal = "review_appeal"
    # future: dispute, refund_request


class SupportCaseParticipantKind(StrEnum):
    platform = "platform"
    merchant = "merchant"
    customer = "customer"


class SupportCaseMessageAuthorKind(StrEnum):
    platform = "platform"
    merchant = "merchant"
    customer = "customer"
    system = "system"  # automated (AI / platform); not a participant


class SupportCaseAudience(StrEnum):
    """Who, besides the platform, may read a message/attachment.

    The platform always sees everything, so it is not representable here; an
    empty audience means an internal, platform-only note.
    """

    merchant = "merchant"
    customer = "customer"


class SupportCaseMessageType(StrEnum):
    """Known message types. Stored as a plain string column (not a DB enum):
    ``chat`` and lifecycle values are generic, while action values are
    domain-specific and grow per case type. Validated at the app boundary.
    """

    chat = "chat"
    # lifecycle (generic)
    opened = "opened"
    closed = "closed"
    # actions (review_appeal)
    appeal_approved = "appeal_approved"
    appeal_denied = "appeal_denied"
    info_requested = "info_requested"


class SupportCase(RecordModel):
    """A thin, type-agnostic conversation primitive.

    Single-table polymorphic base: ``type`` is the discriminator and each
    concrete subclass owns the real foreign key to its domain object. A case
    is a thread of messages + participants + attachments; its open/closed
    state is derived from the lifecycle event messages, not stored.
    """

    __tablename__ = "support_cases"

    type: Mapped[SupportCaseType] = mapped_column(
        StringEnum(SupportCaseType, length=32), nullable=False, index=True
    )

    __mapper_args__ = {"polymorphic_on": "type"}

    @declared_attr
    def participants(cls) -> Mapped[list["SupportCaseParticipant"]]:
        return relationship(
            "SupportCaseParticipant", lazy="raise", back_populates="case"
        )

    @declared_attr
    def messages(cls) -> Mapped[list["SupportCaseMessage"]]:
        return relationship("SupportCaseMessage", lazy="raise", back_populates="case")

    @declared_attr
    def attachments(cls) -> Mapped[list["SupportCaseAttachment"]]:
        return relationship(
            "SupportCaseAttachment", lazy="raise", back_populates="case"
        )


class ReviewAppealSupportCase(SupportCase):
    """A support case handling an organization review appeal."""

    __mapper_args__ = {"polymorphic_identity": SupportCaseType.review_appeal}

    organization_review_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organization_reviews.id", ondelete="restrict"),
        nullable=True,
        default=None,
    )

    @declared_attr
    def organization_review(cls) -> Mapped["OrganizationReview"]:
        return relationship(
            "OrganizationReview", lazy="raise", back_populates="support_case"
        )


# One live review-appeal case per organization review.
Index(
    "ix_support_cases_review_appeal_organization_review_id",
    ReviewAppealSupportCase.organization_review_id,
    unique=True,
    postgresql_where=text("organization_review_id IS NOT NULL AND deleted_at IS NULL"),
)


class SupportCaseParticipant(RecordModel):
    """A party to a case: the platform (staff), the merchant (org), or a
    customer. The subject column is determined by ``kind`` — exactly one is
    set. ``last_read_at`` backs unread state and notification targeting.
    """

    __tablename__ = "support_case_participants"
    __table_args__ = (
        CheckConstraint(
            "(kind = 'platform' AND platform_user_id IS NOT NULL "
            "AND organization_id IS NULL AND customer_id IS NULL) "
            "OR (kind = 'merchant' AND organization_id IS NOT NULL "
            "AND platform_user_id IS NULL AND customer_id IS NULL) "
            "OR (kind = 'customer' AND customer_id IS NOT NULL "
            "AND platform_user_id IS NULL AND organization_id IS NULL)",
            name="subject_matches_kind",
        ),
        # At most one live participant per subject within a case.
        Index(
            "ix_support_case_participants_unique_organization",
            "case_id",
            "organization_id",
            unique=True,
            postgresql_where=text("organization_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index(
            "ix_support_case_participants_unique_platform_user",
            "case_id",
            "platform_user_id",
            unique=True,
            postgresql_where=text(
                "platform_user_id IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
        Index(
            "ix_support_case_participants_unique_customer",
            "case_id",
            "customer_id",
            unique=True,
            postgresql_where=text("customer_id IS NOT NULL AND deleted_at IS NULL"),
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("support_cases.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    kind: Mapped[SupportCaseParticipantKind] = mapped_column(
        StringEnum(SupportCaseParticipantKind, length=16), nullable=False
    )
    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        default=None,
    )
    # Platform staff (kind=platform only).
    platform_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="cascade"), nullable=True, default=None
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=True,
        default=None,
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def case(cls) -> Mapped["SupportCase"]:
        return relationship("SupportCase", lazy="raise", back_populates="participants")


class SupportCaseMessage(RecordModel):
    """An entry in the case timeline.

    ``type`` is ``chat`` for a free-text message and a lifecycle/action value
    for an *event message* (immutable provenance: actor + ``created_at`` +
    ``type``). ``body`` is optional free text. ``audience`` is the set of
    audiences (besides the platform) that may read it — empty = internal note.
    """

    __tablename__ = "support_case_messages"
    __table_args__ = (
        # Target for the attachments composite FK, so an attachment's message
        # is guaranteed to belong to the same case.
        UniqueConstraint("case_id", "id", name="support_case_messages_case_id_id_key"),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("support_cases.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    type: Mapped[SupportCaseMessageType] = mapped_column(
        String(64), nullable=False, index=True
    )
    author_kind: Mapped[SupportCaseMessageAuthorKind] = mapped_column(
        StringEnum(SupportCaseMessageAuthorKind, length=16), nullable=False
    )
    author_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, default=None
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    audience: Mapped[list[SupportCaseAudience]] = mapped_column(
        ARRAY(StringEnum(SupportCaseAudience, length=16)),
        nullable=False,
        default=list,
    )

    @declared_attr
    def case(cls) -> Mapped["SupportCase"]:
        return relationship("SupportCase", lazy="raise", back_populates="messages")


class SupportCaseAttachment(RecordModel):
    """A file attached to a case, optionally to a specific message.

    When ``message_id`` is set, the composite FK guarantees that message
    belongs to the same case. Carries its own ``audience``.
    """

    __tablename__ = "support_case_attachments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id", "message_id"],
            ["support_case_messages.case_id", "support_case_messages.id"],
            name="support_case_attachments_message_fkey",
            ondelete="cascade",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("support_cases.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None, index=True
    )
    file_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("files.id"), nullable=False)
    audience: Mapped[list[SupportCaseAudience]] = mapped_column(
        ARRAY(StringEnum(SupportCaseAudience, length=16)),
        nullable=False,
        default=list,
    )

    @declared_attr
    def case(cls) -> Mapped["SupportCase"]:
        return relationship("SupportCase", lazy="raise", back_populates="attachments")
