"""Run row for the v2 organization review agent.

One row per triggered review. Holds enough state to survive worker
restarts: ``state_snapshot`` is the JSON-serialised
:class:`polar.organization_review_agent.schemas.ReviewState`,
``events`` is the append-only timeline (Plain messages, signal review
events, node transitions), and ``llm_calls`` is the per-call cost
breakdown. Subsequent slices add columns rather than tables:

* Slice 3 — ``owner_user_id``, materialised view over this table.
* Slice 5 — ``due_at`` for ``AwaitMerchantNode`` SLA contracts.
* Slice 9 — ``parent_agent_run_id`` is already present on day 1 so
  pattern-match parent/child links land without a follow-up migration.

The legacy ``OrganizationAgentReview`` rows continue to be written by
the v1 task; v2 runs persist *alongside* them while shadow-mode is
active. Promotion to authoritative (Slice 2 exit gate) does not delete
v1 rows — the comparison surface relies on having both.
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.user import User


class AgentRunStatus(StrEnum):
    """FSM lifecycle position for a single run.

    Mirrors what pydantic-graph would expose if we had to read state out
    of band. Kept narrow and explicit so backoffice filters + routing
    predicates (Slice 3) can reason about it without parsing
    ``state_snapshot``.
    """

    PENDING = "pending"
    """Created but the graph has not yet begun executing."""

    RUNNING = "running"
    """A node is actively executing."""

    AWAITING_HUMAN = "awaiting_human"
    """Parked on a HITL gate (signal review, deny-confirm, or — Slice 5
    — ``AwaitMerchantNode``)."""

    COMPLETED = "completed"
    """Terminal: ``final_report`` is populated and ``organizations.status``
    has been transitioned (when applicable)."""

    FAILED = "failed"
    """Terminal: an exception bubbled past the graph and the run could
    not be safely resumed."""

    CANCELLED = "cancelled"
    """Terminal: an operator (or the system) cancelled the run before
    it reached a verdict."""


class OrganizationReviewAgentRun(RecordModel):
    """Persistent state of one v2 agent invocation.

    All structured payloads are JSONB so schema evolution does not
    require migrations. The trade-off (versioned shape inside JSONB) is
    handled by :mod:`polar.organization_review_agent.schemas`'s Pydantic
    models, which carry their own forward-compat story.
    """

    __tablename__ = "organization_review_agent_runs"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    context: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
        doc=(
            "polar.organization_review.schemas.ReviewContext value, stored "
            "as string for forward-compat. Slice 7 generalises this into "
            "a first-class dispatch."
        ),
    )

    triggered_by: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="system",
        doc=(
            "Free-form trigger label. 'shadow' is reserved for v2 runs "
            "kicked off alongside the legacy v1 analyzer (Slice 1)."
        ),
    )

    status: Mapped[AgentRunStatus] = mapped_column(
        StringEnum(AgentRunStatus, length=32),
        nullable=False,
        default=AgentRunStatus.PENDING,
        index=True,
    )

    current_node: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )

    state_snapshot: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc=(
            "Serialised ReviewState plus pydantic-graph node history. "
            "Replaces the whole list on each node entry — keep an eye on "
            "row size as lanes multiply (see plan: 'state_snapshot row "
            "size' risk)."
        ),
    )

    events: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        doc=(
            "Append-only timeline. Kinds: node_entered, signal_reviewed, "
            "merchant_message_sent, merchant_replied, cancelled, "
            "auto_action_taken (Slice 1+). Append via SQL `||` to avoid "
            "lost-update under concurrent reviewers."
        ),
    )

    llm_calls: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        doc=(
            "Per-call cost/usage breakdown: {agent, model, provider, "
            "input_tokens, output_tokens, cost_usd, duration_ms}. Rolled "
            "up into 'usage' on terminal."
        ),
    )

    usage: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        doc="Aggregate usage rollup: total_input_tokens, total_output_tokens, total_cost_usd.",
    )

    org_snapshot: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc=(
            "Snapshot of organization fields at run start: name, slug, "
            "website, status, details, socials. Backstop for audit when "
            "the live org has drifted since the run."
        ),
    )

    final_report: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc=(
            "Serialised :class:`FinalReport` — set on COMPLETED runs and "
            "(as tentative) on AWAITING_HUMAN at deny-confirm."
        ),
    )

    plain_thread_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "Plain GraphQL thread id associated with this run, if any. "
            "Used by Slice 5 inbound-webhook routing and Slice 4 Case "
            "page message history."
        ),
    )

    heartbeat_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "Last time the executing worker touched this run. The "
            "``resume_stale`` cron (future slice) flips RUNNING rows with "
            "an old heartbeat back to PENDING for re-execution."
        ),
    )

    started_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    parent_agent_run_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("organization_review_agent_runs.id", ondelete="set null"),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "Slice 9: child runs spawned by a PATTERN_MATCH parent point "
            "here. Included on day 1 so adding it later doesn't require "
            "a self-FK migration. ``ondelete=SET NULL`` so deleting a "
            "parent run never cascades into a child fleet."
        ),
    )

    owner_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "Slice 3: per-run ownership for the operator inbox. NULL "
            "for shadow runs or until a reviewer claims the run via "
            "'Assign to me'. ``ondelete=SET NULL`` so user-deletion "
            "doesn't cascade into runs."
        ),
    )

    due_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
        index=True,
        doc=(
            "Slice 5: SLA deadline for runs parked at "
            "AwaitMerchantNode. The cron-driven SLA scanner fires "
            "the configured ``on_timeout`` action when due_at passes "
            "without a merchant reply landing."
        ),
    )

    on_timeout: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        default=None,
        doc=(
            "Slice 5: action to take on due_at breach: "
            "'auto_deny' | 'auto_close_approve' | 'escalate'. NULL "
            "when not parked under an SLA contract."
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
    def owner(cls) -> Mapped["User | None"]:
        return relationship(
            "User",
            lazy="raise",
            foreign_keys=[cls.owner_user_id],
        )

    def __repr__(self) -> str:
        return (
            f"OrganizationReviewAgentRun(id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"context={self.context}, status={self.status})"
        )
