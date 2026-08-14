"""Stripe Radar for Platforms account risk signals (private preview).

Normalizes the two live signals (fraudulent website, fraudulent merchant) into
one small shape. Both arrive as thin events; the full event (fetched by id)
carries the fields under ``data``, but each signal nests them differently.

``data`` is stored verbatim as ``OrganizationRiskSignal.payload``, so this
module also reads it back: ``parse_merchant_payload`` and
``parse_website_payload`` turn a stored payload into the values the backoffice
displays. Keeping both directions here means the Stripe shape is described once.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from polar.models.organization_risk_signal import OrganizationRiskSignal

_REFERENCE_LINE = re.compile(r"^\[(\d+)\]\s+(\S+)$")
_NOTES_MARKER = "NOTES:"
_LINKABLE_SCHEMES = ("http://", "https://")


class StripeAccountRiskLevel(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    ELEVATED = "elevated"
    HIGHEST = "highest"
    # Evaluation could not complete (e.g. unreachable URL).
    UNKNOWN = "unknown"


# Severe enough to store and flag for a human.
ACTIONABLE_RISK_LEVELS: frozenset[StripeAccountRiskLevel] = frozenset(
    {StripeAccountRiskLevel.ELEVATED, StripeAccountRiskLevel.HIGHEST}
)


# Confirmed against a live sandbox. Website nests its fields flat under `data`;
# merchant nests them under `data.fraudulent_merchant`.
ACCOUNT_RISK_EVENT_TYPES: dict[str, OrganizationRiskSignal.Type] = {
    "v2.core.account_signals.fraudulent_website_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
    ),
    "v2.signals.account_signal.fraudulent_merchant_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
    ),
}


@dataclass(frozen=True)
class AccountRiskSignal:
    type: OrganizationRiskSignal.Type
    account_id: str
    risk_level: StripeAccountRiskLevel
    description: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SignalIndicator:
    indicator: str
    impact: str
    description: str


@dataclass(frozen=True)
class MerchantSignalPayload:
    indicators: list[SignalIndicator]
    probability: float | None
    account_id: str | None
    signal_id: str | None
    evaluated_at: datetime | None


@dataclass(frozen=True)
class WebsiteSignalPayload:
    summary: str
    notes: list[str]
    references: dict[int, str]
    account_id: str | None
    signal_id: str | None
    evaluated_at: datetime | None


def is_account_risk_event(event_type: str) -> bool:
    return event_type in ACCOUNT_RISK_EVENT_TYPES


def _coerce_risk_level(value: Any) -> StripeAccountRiskLevel:
    try:
        return StripeAccountRiskLevel(value)
    except ValueError:
        return StripeAccountRiskLevel.UNKNOWN


def _merchant_description(inner: Mapping[str, Any]) -> str | None:
    parts: list[str] = []
    indicators = inner.get("indicators")
    if isinstance(indicators, list) and indicators:
        parts.append("Indicators: " + ", ".join(str(i) for i in indicators))
    probability = inner.get("probability")
    if probability is not None:
        parts.append(f"Probability: {probability}%")
    return ". ".join(parts) or None


def parse_account_risk_event(event: Mapping[str, Any]) -> AccountRiskSignal | None:
    """Read a fetched risk event, or None if it can't be used.

    Returns None when the event isn't a known signal or has no account.
    """
    signal_type = ACCOUNT_RISK_EVENT_TYPES.get(str(event.get("type")))
    if signal_type is None:
        return None

    data = event.get("data")
    if not isinstance(data, Mapping):
        return None

    account_id = data.get("account")
    if not account_id:
        return None

    if signal_type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT:
        inner = data.get("fraudulent_merchant")
        inner = inner if isinstance(inner, Mapping) else {}
        risk_level = _coerce_risk_level(inner.get("risk_level"))
        description = _merchant_description(inner)
    else:
        risk_level = _coerce_risk_level(data.get("risk_level"))
        details = data.get("details")
        description = str(details) if details is not None else None

    return AccountRiskSignal(
        type=signal_type,
        account_id=str(account_id),
        risk_level=risk_level,
        description=description,
        payload=dict(data),
    )


def _optional_str(value: Any) -> str | None:
    return str(value) if value else None


def _optional_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def parse_merchant_payload(payload: Mapping[str, Any]) -> MerchantSignalPayload | None:
    """Read a stored fraudulent merchant payload, or None if it can't be used."""
    inner = payload.get("fraudulent_merchant")
    if not isinstance(inner, Mapping):
        return None

    raw_indicators = inner.get("indicators")
    indicators = [
        SignalIndicator(
            indicator=str(item.get("indicator", "")),
            impact=str(item.get("impact", "")),
            description=str(item.get("description", "")),
        )
        for item in (raw_indicators if isinstance(raw_indicators, list) else [])
        if isinstance(item, Mapping)
    ]
    probability = _optional_float(inner.get("probability"))
    if not indicators and probability is None:
        return None

    return MerchantSignalPayload(
        indicators=indicators,
        probability=probability,
        account_id=_optional_str(payload.get("account")),
        signal_id=_optional_str(payload.get("id")),
        evaluated_at=_optional_datetime(payload.get("evaluated_at")),
    )


def parse_website_payload(payload: Mapping[str, Any]) -> WebsiteSignalPayload | None:
    """Read a stored fraudulent website payload, or None if it can't be used.

    ``details`` is prose: a summary, then notes citing sources as ``[n]``, then
    the numbered list of source URLs (``[1] https://example.com``). Sources that
    aren't web links stay in the text instead of becoming references, so the
    backoffice never turns them into links.
    """
    details = payload.get("details")
    if not isinstance(details, str) or not details.strip():
        return None

    body_lines: list[str] = []
    references: dict[int, str] = {}
    for line in details.splitlines():
        match = _REFERENCE_LINE.match(line.strip())
        if match and match.group(2).lower().startswith(_LINKABLE_SCHEMES):
            references[int(match.group(1))] = match.group(2)
        else:
            body_lines.append(line)

    summary, _, notes = "\n".join(body_lines).strip().partition(_NOTES_MARKER)

    return WebsiteSignalPayload(
        summary=summary.strip(),
        notes=[block.strip() for block in notes.split("\n\n") if block.strip()],
        references=references,
        account_id=_optional_str(payload.get("account")),
        signal_id=_optional_str(payload.get("signal_id")),
        evaluated_at=_optional_datetime(payload.get("evaluated_at")),
    )
