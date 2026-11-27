"""Rendering helpers for organization risk signals (Stripe Radar, Polar checks)."""

import json
import re
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from fastapi import Request
from tagflow import tag, text

from polar.integrations.stripe.account_risk import (
    MerchantSignalPayload,
    WebsiteSignalPayload,
    parse_merchant_payload,
    parse_website_payload,
)
from polar.models import Organization
from polar.models.organization_risk_signal import OrganizationRiskSignal

from ....components import card

_CITATION = re.compile(r"\[(\d+)\]")
_TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M UTC"
_TIMELINE_TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S UTC"


def _humanize(value: str) -> str:
    return value.replace("_", " ").capitalize()


def _timestamp(value: datetime | None) -> str | None:
    return value.strftime(_TIMESTAMP_FORMAT) if value else None


def _signal_type_label(signal: OrganizationRiskSignal) -> str:
    return signal.type.value.replace("_", " ").title()


def _render_signal_list(signals: Sequence[OrganizationRiskSignal]) -> None:
    with tag.div(classes="space-y-3"):
        for signal in signals:
            _render_signal_row(signal)


def _render_signal_row(signal: OrganizationRiskSignal) -> None:
    match signal.risk_level:
        case OrganizationRiskSignal.RiskLevel.HIGHEST:
            badge_class, accent = "badge-error", "border-l-error"
        case OrganizationRiskSignal.RiskLevel.ELEVATED:
            badge_class, accent = "badge-warning", "border-l-warning"
        case _:
            badge_class, accent = "badge-info", "border-l-info"

    with tag.div(classes=f"border border-base-200 rounded p-3 border-l-4 {accent}"):
        with tag.div(classes="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1"):
            with tag.span(classes="text-sm font-medium"):
                text(_signal_type_label(signal))
            with tag.div(classes="badge badge-sm badge-ghost badge-outline"):
                text(signal.source.value)
            with tag.div(classes=f"badge badge-sm {badge_class}"):
                text(signal.risk_level)
            with tag.span(classes="text-xs text-base-content/60 ml-auto"):
                text(signal.created_at.strftime(_TIMESTAMP_FORMAT))

        _render_signal_body(signal)

        if signal.payload:
            _render_raw_payload(signal)


def _render_signal_body(signal: OrganizationRiskSignal) -> None:
    """Render the signal with the parser for its type, or fall back to text."""
    if signal.source == OrganizationRiskSignal.Source.STRIPE:
        if signal.type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT:
            merchant = parse_merchant_payload(signal.payload)
            if merchant is not None:
                _render_merchant_signal(merchant)
                return
        elif signal.type == OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE:
            website = parse_website_payload(signal.payload)
            if website is not None:
                _render_website_signal(website)
                return

    if signal.description:
        with tag.p(classes="text-xs text-base-content/70 mt-1 whitespace-pre-line"):
            text(signal.description)


def _render_merchant_signal(payload: MerchantSignalPayload) -> None:
    if payload.probability is not None:
        with tag.p(classes="text-xs text-base-content/60 mt-1"):
            text(f"Fraud probability: {payload.probability:.2f}%")

    with tag.div(classes="space-y-2 mt-3"):
        for indicator in payload.indicators:
            with tag.div():
                with tag.div(classes="flex flex-wrap items-center gap-x-2 text-xs"):
                    with tag.span(classes="font-medium"):
                        text(_humanize(indicator.indicator))
                    with tag.span(classes="text-base-content/50"):
                        text(_humanize(indicator.impact))
                with tag.p(classes="text-xs text-base-content/70"):
                    text(indicator.description)

    _render_meta(payload)


def _render_website_signal(payload: WebsiteSignalPayload) -> None:
    if payload.summary:
        with tag.p(classes="text-xs text-base-content/70 mt-2"):
            text(payload.summary)

    if payload.notes:
        with tag.div(classes="mt-2"):
            with tag.span(classes="text-xs font-medium"):
                text("Notes")
            for note in payload.notes:
                _render_cited_text(note, payload.references)

    if payload.references:
        with tag.details(classes="mt-2"):
            with tag.summary(
                classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
            ):
                text(f"{len(payload.references)} source(s)")
            with tag.ul(classes="mt-1 space-y-0.5"):
                for number, url in payload.references.items():
                    with tag.li(classes="text-xs flex gap-1"):
                        with tag.span(classes="text-base-content/50"):
                            text(f"[{number}]")
                        with tag.a(
                            href=url,
                            target="_blank",
                            rel="noopener noreferrer",
                            classes="link break-all",
                        ):
                            text(url)

    _render_meta(payload)


def _render_cited_text(note: str, references: dict[int, str]) -> None:
    """Render a paragraph, turning its ``[n]`` citations into source links."""
    with tag.p(classes="text-xs text-base-content/70 mt-1"):
        position = 0
        for match in _CITATION.finditer(note):
            text(note[position : match.start()])
            url = references.get(int(match.group(1)))
            if url is None:
                text(match.group(0))
            else:
                with tag.a(
                    href=url,
                    target="_blank",
                    rel="noopener noreferrer",
                    classes="link align-super text-[10px] mx-0.5",
                ):
                    text(match.group(1))
            position = match.end()
        text(note[position:])


def _render_meta(payload: MerchantSignalPayload | WebsiteSignalPayload) -> None:
    items = (
        ("Account", payload.account_id),
        ("Evaluated", _timestamp(payload.evaluated_at)),
        ("Signal", payload.signal_id),
    )
    values = [(label, value) for label, value in items if value]
    if not values:
        return

    with tag.div(classes="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs"):
        for label, value in values:
            with tag.span(classes="text-base-content/50"):
                text(f"{label}: ")
                with tag.span(classes="font-mono"):
                    text(value)


def _render_raw_payload(signal: OrganizationRiskSignal) -> None:
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
                    "Raised by Stripe's fraud-detection systems (high-severity "
                    "only) and by Polar's own checks."
                )

        _render_signal_list(signals)


def _render_timeline_entry(time: str, label: str, *, muted: bool = True) -> None:
    with tag.div(classes="flex items-baseline gap-3"):
        with tag.span(classes="text-xs text-base-content/60 font-mono shrink-0"):
            text(time)
        classes = "text-sm text-base-content/60" if muted else "text-sm"
        with tag.span(classes=classes):
            text(label)


def _attempt_time(attempt: dict[str, Any]) -> str:
    flagged_at = attempt.get("flagged_at")
    if not flagged_at:
        return "Unknown time"
    return (
        datetime.fromisoformat(str(flagged_at))
        .astimezone(UTC)
        .strftime(_TIMELINE_TIMESTAMP_FORMAT)
    )


def _render_flagged_name_row(request: Request, signal: OrganizationRiskSignal) -> None:
    attempts: list[dict[str, Any]] = signal.payload.get("attempts", [])
    product_name = str(signal.payload.get("product_name", ""))
    product_id = signal.payload.get("product_id")
    kept = signal.type == OrganizationRiskSignal.Type.FLAGGED_PRODUCT_NAME_KEPT
    categories = dict.fromkeys(
        str(attempt["category"]) for attempt in attempts if not attempt.get("phrase")
    )

    with tag.div(classes="border-t border-base-200 py-3"):
        with tag.div(classes="flex flex-wrap items-center gap-2"):
            if product_id:
                with tag.a(
                    href=str(request.url_for("products:get", id=product_id)),
                    classes="link font-semibold",
                ):
                    text(product_name)
            else:
                with tag.span(classes="font-semibold"):
                    text(product_name)
            if kept:
                with tag.div(classes="badge badge-sm badge-ghost badge-outline"):
                    text("Kept flagged name")
            for category in categories:
                with tag.div(classes="badge badge-sm badge-warning badge-outline"):
                    text(_humanize(category))
        with tag.div(classes="mt-2 space-y-1 border-l border-base-300 pl-3"):
            for attempt in attempts:
                _render_timeline_entry(
                    _attempt_time(attempt), f'Tried "{attempt["name"]}"'
                )
            _render_timeline_entry(
                signal.created_at.strftime(_TIMELINE_TIMESTAMP_FORMAT),
                f'Created as "{product_name}"',
                muted=False,
            )


def render_flagged_names_card(
    request: Request,
    organization: Organization,
    signals: Sequence[OrganizationRiskSignal],
) -> None:
    """Product names that showed the AUP warning, shown on the Reviews tab."""
    if not signals:
        return

    with card(bordered=True):
        with tag.div(classes="mb-4"):
            with tag.h2(classes="text-lg font-bold"):
                text("Flagged product names")
            with tag.span(classes="text-sm text-base-content/60"):
                text("Flagged names merchants tried before creating each product.")

        with tag.div(classes="flex flex-wrap items-center gap-4 mb-3 text-sm"):
            if organization.website and organization.website.startswith("http"):
                with tag.a(
                    href=organization.website,
                    classes="link",
                    target="_blank",
                    rel="noopener noreferrer",
                ):
                    text(organization.website)

        for signal in signals:
            _render_flagged_name_row(request, signal)


def render_risk_signals_block(signals: Sequence[OrganizationRiskSignal]) -> None:
    """Signal rows with a sub-heading, embedded in the review card."""
    if not signals:
        return

    with tag.div(classes="mb-4"):
        with tag.h3(classes="text-sm font-bold mb-3"):
            text("Risk Signals")
        _render_signal_list(signals)


__all__ = [
    "render_risk_signals_block",
    "render_risk_signals_card",
]
