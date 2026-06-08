from datetime import datetime
from enum import StrEnum
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


class CaseType(StrEnum):
    """The kind of domain object a case is about.

    The case primitive itself is type-agnostic; the type drives the
    type-specific UI, state machine and the link to the domain object.
    """

    review_appeal = "review_appeal"
    # future: dispute, refund_request


class CaseParticipantKind(StrEnum):
    polar = "polar"
    merchant = "merchant"
    customer = "customer"


class CaseMessageAuthorKind(StrEnum):
    polar = "polar"
    merchant = "merchant"
    customer = "customer"
    system = "system"  # automated (AI / Polar system); not a participant


class CaseAudience(StrEnum):
    """Who, besides Polar, may read a message/attachment.

    Polar always sees everything, so it is not representable here; an empty
    audience means an internal, Polar-only note.
    """

    merchant = "merchant"
    customer = "customer"


class CaseMessageType(StrEnum):
    """Known message types. Stored as a plain string column (not a DB enum):
    ``chat`` and lifecycle values are generic, but action values are
    domain-specific and grow per case type — kept loose to avoid a migration
    and type coupling for every new action. Validated at the app boundary.
    """

    # free-text
    chat = "chat"
    # lifecycle (generic)
    opened = "opened"
    closed = "closed"
    reopened = "reopened"
    # actions (review_appeal)
    appeal_approved = "appeal_approved"
    appeal_denied = "appeal_denied"
    info_requested = "info_requested"


class Case(RecordModel):
    """A thin, type-agnostic conversation primitive.

    A thread of messages + participants + attachments. Its open/closed state
    is **derived** from the lifecycle event messages (opened/closed/reopened),
    not stored — the thread is the single source of truth. It knows nothing
    about any domain type beyond ``type``; the domain object owns its status
    and structured data.

    The link is bidirectional and denormalized:
    - ``(type, resource_id)`` is the durable back-link to the domain object.
      It is **not** an FK — ``resource_id`` is polymorphic (which table is
      given by ``type``), so integrity is enforced in the app. It survives
      soft-delete, keeping the historical origin on an archived case.
    - the domain object also holds ``<domain>.case_id`` pointing at the live
      case; that pointer is cleared on soft-delete.
    """

    __tablename__ = "cases"
    __table_args__ = (
        # One live case per domain object (1:1). Not an FK (resource_id is
        # polymorphic). Partial index lets a soft-deleted case coexist with a
        # fresh one for the same object.
        Index(
            "ix_cases_type_resource_id",
            "type",
            "resource_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    type: Mapped[CaseType] = mapped_column(
        StringEnum(CaseType, length=32), nullable=False
    )
    # FK-less back-link to the domain object; interpret via ``type``.
    resource_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)

    @declared_attr
    def participants(cls) -> Mapped[list["CaseParticipant"]]:
        return relationship("CaseParticipant", lazy="raise", back_populates="case")

    @declared_attr
    def messages(cls) -> Mapped[list["CaseMessage"]]:
        return relationship("CaseMessage", lazy="raise", back_populates="case")

    @declared_attr
    def attachments(cls) -> Mapped[list["CaseAttachment"]]:
        return relationship("CaseAttachment", lazy="raise", back_populates="case")


class CaseParticipant(RecordModel):
    """A party to a case: Polar (staff), the merchant (org), or a customer.

    Exactly one subject column is set, matching ``kind``. The merchant is
    modeled org-level; access among its members is enforced at the service
    layer. ``last_read_at`` backs unread state and notification targeting.
    """

    __tablename__ = "case_participants"
    __table_args__ = (
        # The subject column is determined by ``kind`` — exactly one is set.
        CheckConstraint(
            "(kind = 'polar' AND staff_user_id IS NOT NULL "
            "AND organization_id IS NULL AND customer_id IS NULL) "
            "OR (kind = 'merchant' AND organization_id IS NOT NULL "
            "AND staff_user_id IS NULL AND customer_id IS NULL) "
            "OR (kind = 'customer' AND customer_id IS NOT NULL "
            "AND staff_user_id IS NULL AND organization_id IS NULL)",
            name="subject_matches_kind",
        ),
        # At most one live participant per subject within a case.
        Index(
            "ix_case_participants_unique_organization",
            "case_id",
            "organization_id",
            unique=True,
            postgresql_where=text("organization_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index(
            "ix_case_participants_unique_staff_user",
            "case_id",
            "staff_user_id",
            unique=True,
            postgresql_where=text("staff_user_id IS NOT NULL AND deleted_at IS NULL"),
        ),
        Index(
            "ix_case_participants_unique_customer",
            "case_id",
            "customer_id",
            unique=True,
            postgresql_where=text("customer_id IS NOT NULL AND deleted_at IS NULL"),
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="cascade"), nullable=False, index=True
    )
    kind: Mapped[CaseParticipantKind] = mapped_column(
        StringEnum(CaseParticipantKind, length=16), nullable=False
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        default=None,
    )
    # Polar staff (kind=polar only).
    staff_user_id: Mapped[UUID | None] = mapped_column(
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
    def case(cls) -> Mapped["Case"]:
        return relationship("Case", lazy="raise", back_populates="participants")


class CaseMessage(RecordModel):
    """An entry in the case timeline.

    ``type`` is ``chat`` for a free-text message and a lifecycle/action value
    for an *event message*. Event messages are immutable time-based
    provenance: actor = (``author_kind``, ``author_user_id``), when =
    ``created_at``, what = ``type``.

    ``body`` is optional free text: the message content for ``chat``, or an
    optional note accompanying an event message.

    ``audience`` is the set of audiences (besides Polar, who always sees
    everything) that may read the message — empty means an internal,
    Polar-only note.
    """

    __tablename__ = "case_messages"
    __table_args__ = (
        # Target for the case_attachments composite FK, so an attachment's
        # message is guaranteed to belong to the same case.
        UniqueConstraint("case_id", "id", name="case_messages_case_id_id_key"),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="cascade"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    author_kind: Mapped[CaseMessageAuthorKind] = mapped_column(
        StringEnum(CaseMessageAuthorKind, length=16), nullable=False
    )
    author_user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, default=None
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # audiences (besides Polar, who always sees all) that may read this;
    # [] = internal, Polar-only note.
    audience: Mapped[list[CaseAudience]] = mapped_column(
        ARRAY(StringEnum(CaseAudience, length=16)),
        nullable=False,
        default=list,
    )

    @declared_attr
    def case(cls) -> Mapped["Case"]:
        return relationship("Case", lazy="raise", back_populates="messages")


class CaseAttachment(RecordModel):
    """A file attached to a case, optionally to a specific message.

    Carries its own ``audience`` (e.g. an internal evidence file vs. a
    merchant-visible upload). Backed by the shared ``File`` model. When
    ``message_id`` is set, the composite FK guarantees that message belongs
    to the same case.
    """

    __tablename__ = "case_attachments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["case_id", "message_id"],
            ["case_messages.case_id", "case_messages.id"],
            name="case_attachments_message_fkey",
            ondelete="cascade",
        ),
    )

    case_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("cases.id", ondelete="cascade"), nullable=False, index=True
    )
    message_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None, index=True
    )
    file_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("files.id"), nullable=False)
    audience: Mapped[list[CaseAudience]] = mapped_column(
        ARRAY(StringEnum(CaseAudience, length=16)),
        nullable=False,
        default=list,
    )

    @declared_attr
    def case(cls) -> Mapped["Case"]:
        return relationship("Case", lazy="raise", back_populates="attachments")
