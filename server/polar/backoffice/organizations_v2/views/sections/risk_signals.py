"""Rendering helpers for external risk signals (e.g. Stripe Radar)."""

import json
from collections.abc import Sequence

from tagflow import tag, text

from polar.models.organization_risk_signal import OrganizationRiskSignal

from ....components import card


def _signal_type_label(signal: OrganizationRiskSignal) -> str:
    return signal.type.value.replace("_", " ").title()


def _render_signal_list(signals: Sequence[OrganizationRiskSignal]) -> None:
    with tag.div(classes="space-y-3"):
        for signal in signals:
            _render_signal_row(signal)


def _render_signal_row(signal: OrganizationRiskSignal) -> None:
    is_highest = signal.risk_level == OrganizationRiskSignal.HIGHEST_RISK_LEVEL
    badge_class = "badge-error" if is_highest else "badge-warning"
    accent = "border-l-error" if is_highest else "border-l-warning"

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
                    "Raised by external fraud-detection systems. Only "
                    "high-severity signals are recorded."
                )

        _render_signal_list(signals)


def render_risk_signals_block(signals: Sequence[OrganizationRiskSignal]) -> None:
    """Signal rows with a sub-heading, embedded in the review card."""
    if not signals:
        return

    with tag.div(classes="mb-4"):
        with tag.h3(classes="text-sm font-bold mb-3"):
            text("External Risk Signals")
        _render_signal_list(signals)


__all__ = [
    "render_risk_signals_block",
    "render_risk_signals_card",
]
