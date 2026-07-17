"""Rendering helpers for external risk signals (e.g. Stripe Radar)."""

import json
from collections.abc import Sequence

from tagflow import tag, text

from polar.models.organization_risk_signal import OrganizationRiskSignal

from ....components import card

# DaisyUI badge class per risk level. Only 'elevated' and 'highest' are
# recorded today; anything else falls back to a neutral badge.
SIGNAL_RISK_BADGE: dict[str, str] = {
    "elevated": "badge-warning",
    "highest": "badge-error",
}


def _signal_type_label(signal: OrganizationRiskSignal) -> str:
    return signal.type.value.replace("_", " ").title()


def render_risk_signal_row(signal: OrganizationRiskSignal) -> None:
    badge_class = SIGNAL_RISK_BADGE.get(signal.risk_level, "badge-ghost")
    accent = "border-l-error" if signal.risk_level == "highest" else "border-l-warning"

    with tag.div(classes=f"border border-base-200 rounded p-3 border-l-4 {accent}"):
        with tag.div(classes="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1"):
            with tag.span(classes="text-sm font-medium"):
                text(_signal_type_label(signal))
            with tag.div(classes="badge badge-sm badge-ghost badge-outline"):
                text(signal.source.value)
            with tag.div(classes=f"badge badge-sm {badge_class}"):
                text(signal.risk_level)
            with tag.span(classes="text-xs text-base-content/60 ml-auto"):
                text(signal.created_at.strftime("%Y-%m-%d %H:%M UTC"))

        if signal.description:
            with tag.p(classes="text-xs text-base-content/70 mt-1"):
                text(signal.description)

        if signal.payload:
            with tag.details(classes="mt-2"):
                with tag.summary(
                    classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
                ):
                    text("View raw payload")
                with tag.pre(
                    classes="text-xs bg-base-200 p-3 rounded mt-2 overflow-x-auto max-h-64 overflow-y-auto"
                ):
                    text(json.dumps(signal.payload, indent=2, default=str))


def render_risk_signals_card(signals: Sequence[OrganizationRiskSignal]) -> None:
    """Full list of risk signals, shown on the Reviews tab."""
    if not signals:
        return

    with card(bordered=True):
        with tag.div(classes="mb-4"):
            with tag.h2(classes="text-lg font-bold"):
                text("Risk Signals")
            with tag.span(classes="text-sm text-base-content/60"):
                text(
                    "Raised by external fraud-detection systems. Only 'elevated' "
                    "and 'highest' severity signals are recorded."
                )

        with tag.div(classes="space-y-3"):
            for signal in signals:
                render_risk_signal_row(signal)


def render_risk_signals_block(signals: Sequence[OrganizationRiskSignal]) -> None:
    """Signal rows with a sub-heading, embedded in the review card."""
    if not signals:
        return

    with tag.div(classes="mb-4"):
        with tag.h3(classes="text-sm font-bold mb-3"):
            text("External Risk Signals")
        with tag.div(classes="space-y-3"):
            for signal in signals:
                render_risk_signal_row(signal)


__all__ = [
    "render_risk_signal_row",
    "render_risk_signals_block",
    "render_risk_signals_card",
]
