"""Stripe Radar for Platforms account risk signals (private preview).

Normalizes the two live signals (fraudulent website, fraudulent merchant) into
one small shape.

Merchant and website evaluations on the Signals API arrive as thin
``v2.signals.account_signal.*`` notifications. ``data`` is empty;
``related_object.id`` is an Account Signal (``acctsig_…``) fetched from
``/v2/signals/account_signals/:id``. Older website snapshots
(``v2.core.account_signals.*``) still carry fields under ``data``.

That resource nests type-specific fields (``fraudulent_merchant``,
``fraudulent_website``). Merchant signals put the connected account on
``account_details.account``. Website evaluations are requested with the URL
itself, so the signal may have no account and instead echo the URL under
``account_details.data.defaults.profile.business_url``.

``data`` / the Account Signal is stored verbatim as
``OrganizationRiskSignal.payload``. ``parse_merchant_payload`` and
``parse_website_payload`` read it back for the backoffice, so the Stripe shape
is described once.
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


# Confirmed against a live sandbox and current Stripe docs (2026-08-26.preview).
ACCOUNT_RISK_EVENT_TYPES: dict[str, OrganizationRiskSignal.Type] = {
    "v2.core.account_signals.fraudulent_website_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
    ),
    "v2.signals.account_signal.fraudulent_website_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
    ),
    "v2.signals.account_signal.fraudulent_merchant_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
    ),
}

ACCOUNT_SIGNAL_OBJECT_TYPES: dict[str, OrganizationRiskSignal.Type] = {
    OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE.value: (
        OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
    ),
    OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT.value: (
        OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
    ),
}


@dataclass(frozen=True)
class AccountRiskSignal:
    type: OrganizationRiskSignal.Type
    risk_level: StripeAccountRiskLevel
    account_id: str | None = None
    website_url: str | None = None
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


def related_object_id(event: Mapping[str, Any]) -> str | None:
    related = event.get("related_object")
    if not isinstance(related, Mapping):
        return None
    object_id = related.get("id")
    return str(object_id) if object_id else None


def _coerce_risk_level(value: Any) -> StripeAccountRiskLevel:
    try:
        return StripeAccountRiskLevel(value)
    except ValueError:
        return StripeAccountRiskLevel.UNKNOWN


def _account_id(data: Mapping[str, Any]) -> str | None:
    account = data.get("account")
    if account:
        return str(account)
    details = data.get("account_details")
    if isinstance(details, Mapping) and details.get("account"):
        return str(details["account"])
    return None


def _website_url(data: Mapping[str, Any]) -> str | None:
    details = data.get("account_details")
    if not isinstance(details, Mapping):
        return None
    extra = details.get("data")
    profile_source = extra if isinstance(extra, Mapping) else details
    defaults = profile_source.get("defaults")
    if not isinstance(defaults, Mapping):
        return None
    profile = defaults.get("profile")
    if isinstance(profile, Mapping) and profile.get("business_url"):
        return str(profile["business_url"])
    return None


def _signal_inner(
    signal_type: OrganizationRiskSignal.Type, data: Mapping[str, Any]
) -> Mapping[str, Any]:
    nested = data.get(signal_type.value)
    return nested if isinstance(nested, Mapping) else {}


def _parse_indicators(raw: Any) -> list[SignalIndicator]:
    if not isinstance(raw, list):
        return []
    indicators: list[SignalIndicator] = []
    for item in raw:
        if isinstance(item, Mapping):
            indicators.append(
                SignalIndicator(
                    indicator=str(item.get("indicator", "")),
                    impact=str(item.get("impact", "")),
                    description=str(
                        item.get("description") or item.get("explanation") or ""
                    ),
                )
            )
        elif item:
            indicators.append(
                SignalIndicator(indicator=str(item), impact="", description="")
            )
    return indicators


def _merchant_description(inner: Mapping[str, Any]) -> str | None:
    parts: list[str] = []
    indicators = _parse_indicators(inner.get("indicators"))
    names = [item.indicator for item in indicators if item.indicator]
    if names:
        parts.append("Indicators: " + ", ".join(names))
    probability = inner.get("probability")
    if probability is not None:
        parts.append(f"Probability: {probability}%")
    return ". ".join(parts) or None


def _parse_payload(
    signal_type: OrganizationRiskSignal.Type, data: Mapping[str, Any]
) -> AccountRiskSignal | None:
    account_id = _account_id(data)
    website_url = _website_url(data)
    if signal_type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT:
        if not account_id:
            return None
    elif not account_id and not website_url:
        return None

    inner = _signal_inner(signal_type, data)
    risk_level = _coerce_risk_level(inner.get("risk_level") or data.get("risk_level"))
    if signal_type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT:
        description = _merchant_description(inner)
    else:
        details = inner.get("details", data.get("details"))
        description = str(details) if details is not None else None

    return AccountRiskSignal(
        type=signal_type,
        risk_level=risk_level,
        account_id=account_id,
        website_url=website_url,
        description=description,
        payload=dict(data),
    )


def parse_account_risk_event(event: Mapping[str, Any]) -> AccountRiskSignal | None:
    """Read a fetched risk event, or None if it can't be used.

    Returns None when the event isn't a known signal or has no account or website.
    """
    signal_type = ACCOUNT_RISK_EVENT_TYPES.get(str(event.get("type")))
    if signal_type is None:
        return None

    data = event.get("data")
    if not isinstance(data, Mapping):
        return None

    return _parse_payload(signal_type, data)


def parse_account_signal(payload: Mapping[str, Any]) -> AccountRiskSignal | None:
    """Read a fetched Account Signal resource, or None if it can't be used."""
    signal_type = ACCOUNT_SIGNAL_OBJECT_TYPES.get(str(payload.get("type")))
    if signal_type is None:
        return None
    return _parse_payload(signal_type, payload)


def _optional_str(value: Any) -> str | None:
    return str(value) if value else None


def _optional_float(value: Any) -> float | None:
    try:
        return float(value)
    except TypeError, ValueError:
        return None


def _optional_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _payload_signal_id(payload: Mapping[str, Any]) -> str | None:
    return _optional_str(payload.get("id") or payload.get("signal_id"))


def _payload_evaluated_at(payload: Mapping[str, Any]) -> datetime | None:
    return _optional_datetime(payload.get("evaluated_at") or payload.get("created"))


def parse_merchant_payload(payload: Mapping[str, Any]) -> MerchantSignalPayload | None:
    """Read a stored fraudulent merchant payload, or None if it can't be used."""
    inner = _signal_inner(OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT, payload)
    indicators = _parse_indicators(inner.get("indicators"))
    probability = _optional_float(inner.get("probability"))
    if not indicators and probability is None:
        return None

    return MerchantSignalPayload(
        indicators=indicators,
        probability=probability,
        account_id=_account_id(payload),
        signal_id=_payload_signal_id(payload),
        evaluated_at=_payload_evaluated_at(payload),
    )


def parse_website_payload(payload: Mapping[str, Any]) -> WebsiteSignalPayload | None:
    """Read a stored fraudulent website payload, or None if it can't be used.

    ``details`` is prose: a summary, then notes citing sources as ``[n]``, then
    the numbered list of source URLs (``[1] https://example.com``). Sources that
    aren't web links stay in the text instead of becoming references, so the
    backoffice never turns them into links.
    """
    inner = _signal_inner(OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE, payload)
    details = inner.get("details", payload.get("details"))
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
        account_id=_account_id(payload),
        signal_id=_payload_signal_id(payload),
        evaluated_at=_payload_evaluated_at(payload),
    )
