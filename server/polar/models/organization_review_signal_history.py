"""Cross-run memory for individual signal resolutions.

One row per ``(organization_id, run_id, signal_kind, summary_fingerprint)``
the v2 agent has emitted. Carries the reviewer's verdict on whether
the signal was a real concern or a false positive, plus the freeform
reason they typed. Future Decide invocations on the same org read
this table to weight new signals: a kind previously confirmed as
real raises confidence, one previously discarded lowers it.

``retired_at`` lets operators mark a memory entry as "no longer
representative" (e.g. the merchant has demonstrably changed
behaviour) without deleting it — the entry is excluded from memory
queries but stays in the audit log.

Embedding columns are deferred to a later slice; the basic exact-
kind match in the repository is enough to start with, and the
embedding-based semantic dedup the design plan calls for can layer
on this same row shape.
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.organization_review_agent_run import (
        OrganizationReviewAgentRun,
    )
    from polar.models.user import User


class SignalResolution(StrEnum):
    """How a reviewer adjudicated a single emitted signal.

    Mirrors ``polar.organization_review_agent.schemas.SignalResolution``
    so the DB and the in-memory Pydantic schema agree on the
    vocabulary. Kept as a separate enum here to avoid a SQLAlchemy
    import-time cycle through the agent module.
    """

    PENDING = "pending"
    APPROVED = "approved"
    DISCARDED = "discarded"


class OrganizationReviewSignalHistory(RecordModel):
    """A single signal's lifetime: who emitted it, who reviewed it, what they said."""

    __tablename__ = "organization_review_signal_history"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    agent_run_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "organization_review_agent_runs.id", ondelete="cascade"
        ),
        nullable=False,
        index=True,
        doc="The agent run that emitted this signal.",
    )

    kind: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc=(
            "Value from polar.organization_review_agent.taxonomy.SignalKind. "
            "Stored as string for forward-compat (registry edits don't "
            "require a migration)."
        ),
    )

    severity: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        doc="low / medium / high — the severity emitted at run time.",
    )

    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="The one-line internal summary the lane produced.",
    )

    evidence: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc=(
            "Lane-specific structured backing data (refund counts, "
            "blocked org slugs, etc). Surfaced in the agent-run page "
            "but never shown to merchants."
        ),
    )

    resolution: Mapped[SignalResolution] = mapped_column(
        String(16),
        nullable=False,
        default=SignalResolution.PENDING,
        index=True,
        doc=(
            "Reviewer verdict: PENDING (not yet reviewed), APPROVED "
            "(real concern), DISCARDED (false positive). Memory queries "
            "weigh APPROVED + DISCARDED counts to inform future runs."
        ),
    )

    reviewer_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        doc=(
            "≥3-char free-text reason the reviewer typed when clicking "
            "approved/discarded. None while resolution is PENDING."
        ),
    )

    reviewed_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        default=None,
        doc=(
            "User who set the resolution. ``set null`` on user delete "
            "so the audit trail survives account deletion."
        ),
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    retired_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "When set, the row is excluded from memory queries. Used "
            "for operators to mark a past adjudication as no-longer-"
            "representative without losing the audit trail."
        ),
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship(
            "Organization",
            lazy="raise",
            foreign_keys=[cls.organization_id],
        )

    @declared_attr
    def agent_run(cls) -> Mapped["OrganizationReviewAgentRun"]:
        return relationship(
            "OrganizationReviewAgentRun",
            lazy="raise",
            foreign_keys=[cls.agent_run_id],
        )

    @declared_attr
    def reviewed_by(cls) -> Mapped["User | None"]:
        return relationship(
            "User",
            lazy="raise",
            foreign_keys=[cls.reviewed_by_user_id],
        )

    def __repr__(self) -> str:
        return (
            f"OrganizationReviewSignalHistory(id={self.id}, "
            f"organization_id={self.organization_id}, kind={self.kind}, "
            f"resolution={self.resolution})"
        )
