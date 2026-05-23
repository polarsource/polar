"""Pydantic schemas for v2 agent runs.

These are the shapes that travel on the FSM state, the run row, and the
serialised JSONB columns. Two intentional design choices:

* ``RaisedSignal.kind`` is typed as :class:`SignalKind` (a ``StrEnum``)
  — Pydantic rejects unregistered string values at validation time, so
  a lane that emits a typo dies during the lane run, not silently in
  Decide.
* Everything here must be JSON-serialisable. Non-serialisable handles
  (DB sessions, model clients, MCP servers, httpx clients) live on the
  ``RunDeps`` object lanes receive at call time, not on the state.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema

from .taxonomy import Severity, SignalDimension, SignalKind

__all__ = [
    "AgentVerdict",
    "FinalReport",
    "LaneFacts",
    "RaisedSignal",
    "ReaderCues",
    "ResolvedSignal",
    "ReviewState",
    "Severity",
    "SignalDimension",
    "SignalKind",
    "SignalResolution",
]


class AgentVerdict(StrEnum):
    """Terminal-state verdict produced by the Decide node.

    Mirrors :class:`polar.organization_review.schemas.ReviewVerdict` to
    keep v1 / v2 comparisons trivial. ``NEEDS_HUMAN`` covers both the
    deny-confirm and the await-merchant park states; the actual park
    reason lives on the run row's ``current_node``.
    """

    APPROVE = "approve"
    DENY = "deny"
    NEEDS_HUMAN = "needs_human"


class SignalResolution(StrEnum):
    """Outcome of human review on a single signal.

    Mirrors the legacy :class:`polar.organization_review.schemas.DecisionType`
    vocabulary but signal-scoped, not whole-org-scoped. A signal stays
    ``PENDING`` until a reviewer clicks one of the chips on the agent-run
    page.
    """

    PENDING = "pending"
    APPROVED = "approved"  # reviewer agrees this is a real concern
    DISCARDED = "discarded"  # reviewer judges this a false positive


class RaisedSignal(Schema):
    """A finding emitted by a lane during the Investigate phase.

    Lanes import :class:`SignalKind` and reference members by name,
    e.g. ``SignalKind.HIGH_DISPUTE_RATE``. Pydantic enforces that the
    string value matches a registered member at validation time.
    """

    kind: SignalKind = Field(
        description=(
            "Which registered signal kind this is. Must exist in "
            "polar.organization_review_agent.taxonomy.SIGNAL_KIND_REGISTRY."
        ),
    )
    severity: Severity | None = Field(
        default=None,
        description=(
            "Per-emission severity override. When None, the registry's "
            "default_severity for this kind is used."
        ),
    )
    summary: str = Field(
        description=(
            "One-line internal-facing description. Quote concrete numbers "
            "where possible (e.g. 'refund rate 18% over last 90d (47/261)')."
        ),
    )
    evidence: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Lane-specific structured data backing the summary. Surfaced "
            "in the backoffice agent-run page; never shown to merchants."
        ),
    )


class ResolvedSignal(Schema):
    """A raised signal once a reviewer has weighed in (or auto-resolved).

    Persisted both as part of the run's final report and as a row in
    ``organization_review_signal_history`` for cross-run memory.
    """

    raised: RaisedSignal
    resolution: SignalResolution = SignalResolution.PENDING
    reviewer_reason: str | None = Field(
        default=None,
        description=(
            "≥3-char free-text reason a reviewer must give when clicking "
            "approved/discarded. None while resolution is PENDING."
        ),
    )
    reviewed_at: datetime | None = None
    reviewed_by_user_id: UUID | None = None


class LaneFacts(Schema):
    """Per-lane structured facts captured during Investigate.

    A loose container: each lane is free to put whatever structured data
    it wants under its own key, scoped by its lane name. Decide receives
    only the rendered markdown summary of these facts, never the raw
    payload — that stays inside the lane's lifetime.
    """

    name: str = Field(description="Lane name, e.g. 'history', 'payments'.")
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Lane-private structured data. Survives the run for backoffice "
            "rendering + later auditing; never serialised to merchants."
        ),
    )


class ReaderCues(Schema):
    """Structured cues produced by a :class:`Reader` over untrusted text.

    See ``readers/base.py``. The shape is intentionally generic — each
    Reader subclass narrows the ``cues`` payload via its own
    :class:`ReaderCues` subclass.
    """

    source: str = Field(
        description=(
            "What was read: 'website_page', 'plain_inbound', "
            "'appeal_reason', etc."
        ),
    )
    summary: str = Field(
        description=(
            "Reader-produced summary of the untrusted text. This is "
            "what Decide ultimately sees; the raw text is discarded."
        ),
    )
    addressed_signal_kinds: list[SignalKind] = Field(
        default_factory=list,
        description=(
            "Which already-raised signals the merchant text appears to "
            "address. Lets Decide weight prior signals correctly."
        ),
    )
    tone: str | None = Field(
        default=None,
        description="Cooperative / defensive / hostile / silent.",
    )
    attachments_summary: str | None = None
    quoted_excerpts: list[str] = Field(
        default_factory=list,
        description=(
            "Short (<200 char) verbatim excerpts the reader judged safe "
            "to surface to Decide. Reader is responsible for redaction."
        ),
    )


class FinalReport(Schema):
    """Decide-node output that the reviewer commits or overrides.

    Held in :attr:`ReviewState.tentative_report` while parked at
    deny-confirm; copied to ``organization_review_agent_runs.final_report``
    on commit. Note the deliberate ``summary`` / ``merchant_summary``
    split — only ``merchant_summary`` is safe to surface on the
    merchant Case page (Slice 4).
    """

    verdict: AgentVerdict
    summary: str = Field(
        description="Internal-facing summary of the decision."
    )
    merchant_summary: str = Field(
        description=(
            "Merchant-safe summary. Must not mention scraped website "
            "content, prior organizations, internal risk scores, or "
            "Stripe verification specifics. Used as the body of the deny "
            "card on the merchant dashboard."
        ),
    )
    violated_sections: list[str] = Field(default_factory=list)
    decisive_signal_kinds: list[SignalKind] = Field(
        default_factory=list,
        description=(
            "Signals Decide flagged as load-bearing in the verdict, in "
            "order of weight. Used by Slice 1 auto-take eligibility and "
            "by Slice 4 merchant disclosure."
        ),
    )
    recommended_action: str = Field(
        description="Specific next step for the human reviewer."
    )


class ReviewState(Schema):
    """The FSM state persisted across node transitions.

    JSON-serialisable on purpose: lives in
    ``organization_review_agent_runs.state_snapshot`` and rehydrates
    cleanly after worker restarts. Non-serialisable handles (sessions,
    model clients, MCP servers) live on the parallel ``RunDeps`` object
    a future graph slice will introduce.
    """

    organization_id: UUID
    context: str = Field(
        description=(
            "polar.organization_review.schemas.ReviewContext value "
            "(stored as string for forward-compat). Slice 7 generalises "
            "this into a first-class dispatch."
        ),
    )
    triggered_by: str = Field(
        default="system",
        description=(
            "Free-form trigger label. 'shadow' is reserved for runs that "
            "execute alongside the legacy v1 analyzer (Slice 1)."
        ),
    )
    lanes_enabled: list[str] = Field(
        default_factory=list,
        description=(
            "Names of lanes the Triage node selected. Slice 0 ships an "
            "empty list (lane registry comes in a later slice)."
        ),
    )
    findings: dict[str, LaneFacts] = Field(
        default_factory=dict,
        description="Per-lane facts, keyed by lane name.",
    )
    raised_signals: list[RaisedSignal] = Field(default_factory=list)
    resolved_signals: list[ResolvedSignal] = Field(default_factory=list)
    reader_cues: list[ReaderCues] = Field(
        default_factory=list,
        description=(
            "Cues collected by all Reader invocations during this run. "
            "Decide concatenates these in chronological order."
        ),
    )
    tentative_report: FinalReport | None = None
    merchant_replies: list[ReaderCues] = Field(
        default_factory=list,
        description=(
            "Slice 5: cues produced by MerchantMessageReader over inbound "
            "Plain replies. Filled by AwaitMerchantNode on resume."
        ),
    )
