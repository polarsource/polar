"""LLM Decide agent for the v2 review graph.

Builds a pydantic-ai Agent whose structured output is a
:class:`FinalReport`. Production uses the configured Pydantic AI
Gateway model; tests/e2e inject a ``TestModel``/``FunctionModel`` via
``Agent.override(model=...)`` so the LLM code path is exercised
without a live API key.

The DecideNode prefers this agent and falls back to the deterministic
heuristic on any error (missing credentials, timeout, provider
outage), so the graph always produces a verdict.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from polar.config import settings

from .schemas import FinalReport, RaisedSignal, ReviewState, Severity
from .taxonomy import spec_for

if TYPE_CHECKING:
    from pydantic_ai import Agent
    from pydantic_ai.models import Model

log = structlog.get_logger(__name__)


DECIDE_SYSTEM_PROMPT = """\
You are Polar's organization-review decider. You receive a structured
summary of automated investigation lanes (history, identity, payout
account, payments, products, categorisation) plus the discrete signals
they raised and the organization's prior-review memory.

Produce a FinalReport:
- verdict: APPROVE when nothing blocks activation; DENY when a
  high-severity / policy-violating signal is present; NEEDS_HUMAN when
  the evidence is mixed or medium-severity and warrants a human look.
- summary: 1-2 sentences for internal reviewers (may reference
  signals, prior orgs, risk specifics).
- merchant_summary: merchant-safe wording. MUST NOT mention scraped
  website content, prior organizations, internal risk scores, or
  Stripe verification specifics. Empty string when verdict is APPROVE.
- decisive_signal_kinds: the signal kinds that drove the verdict.
- recommended_action: the concrete next step for the human reviewer.

Be conservative: a single high-severity signal should not be
approved away. Prior-memory entries marked discarded for this org
lower a signal's weight; entries marked approved raise it.
"""


def build_decide_agent(model: "Model | str | None" = None) -> "Agent[None, FinalReport]":
    """Construct the Decide agent.

    ``model`` may be a concrete pydantic-ai ``Model`` (used directly —
    this is how tests inject a ``FunctionModel``), a model-id string,
    or ``None`` to use the configured gateway model. Construction is
    lazy/cheap; the network call only happens on ``.run``.
    """

    from pydantic_ai import Agent

    if model is None or isinstance(model, str):
        model_instance, _provider, _name = settings.get_pydantic_gateway_model(
            model if isinstance(model, str) else None
        )
        resolved: "Model" = model_instance
    else:
        resolved = model

    return Agent(
        resolved,
        output_type=FinalReport,
        system_prompt=DECIDE_SYSTEM_PROMPT,
        model_settings={"temperature": 0},
    )


def render_decide_prompt(
    state: ReviewState,
    *,
    memory: dict[str, dict[str, int]] | None = None,
) -> str:
    """Render lane facts + signals + memory into the Decide prompt.

    Deliberately text-only and free of raw merchant content: lanes
    already reduced untrusted input to structured facts/cues, and only
    those summaries reach the model here.
    """

    memory = memory or {}
    lines: list[str] = []
    lines.append(f"Organization review context: {state.context}")
    lines.append("")

    lines.append("## Lane facts")
    if state.findings:
        for name, facts in sorted(state.findings.items()):
            lines.append(f"### {name}")
            for k, v in (facts.payload or {}).items():
                lines.append(f"- {k}: {v}")
    else:
        lines.append("(no lane facts collected)")
    lines.append("")

    lines.append("## Raised signals")
    if state.raised_signals:
        for sig in state.raised_signals:
            sev = (
                sig.severity.value
                if sig.severity is not None
                else spec_for(sig.kind).default_severity.value
            )
            mem = memory.get(sig.kind.value)
            mem_note = (
                f" [memory approved={mem.get('approved', 0)} "
                f"discarded={mem.get('discarded', 0)}]"
                if mem
                else ""
            )
            lines.append(f"- [{sev}] {sig.kind.value}: {sig.summary}{mem_note}")
    else:
        lines.append("(no signals raised)")
    lines.append("")

    if state.reader_cues:
        lines.append("## Reader cues (merchant-supplied, sandboxed)")
        for cue in state.reader_cues:
            lines.append(f"- [{cue.source}] {cue.summary}")
        lines.append("")

    lines.append(
        "Decide the verdict per your instructions and produce a FinalReport."
    )
    return "\n".join(lines)


def heuristic_severities(signals: list[RaisedSignal]) -> list[Severity]:
    """Effective severities for the heuristic fallback (re-exported so
    DecideNode and the agent module share one definition)."""

    out: list[Severity] = []
    for sig in signals:
        out.append(
            sig.severity
            if sig.severity is not None
            else spec_for(sig.kind).default_severity
        )
    return out


__all__ = [
    "DECIDE_SYSTEM_PROMPT",
    "build_decide_agent",
    "heuristic_severities",
    "render_decide_prompt",
]
