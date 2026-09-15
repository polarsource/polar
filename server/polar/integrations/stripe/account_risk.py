"""Stripe Radar for Platforms account risk signals (private preview).

Normalizes the two live signals (fraudulent website, fraudulent merchant).
Thin ``v2.signals.account_signal.*`` events point at an Account Signal
resource; this module parses that resource and stored payloads for the
backoffice.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from polar.exceptions import PolarError
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


class UnknownAccountRiskEvaluation(PolarError):
    def __init__(self, evaluation_id: str) -> None:
        self.evaluation_id = evaluation_id
        super().__init__(f"No pending website evaluation for {evaluation_id}.")


ACCOUNT_RISK_EVENT_TYPES: dict[str, OrganizationRiskSignal.Type] = {
    "v2.signals.account_signal.fraudulent_website_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE
    ),
    "v2.signals.account_signal.fraudulent_merchant_ready": (
        OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT
    ),
}


@dataclass(frozen=True)
class AccountRiskSignal:
    type: OrganizationRiskSignal.Type
    risk_level: StripeAccountRiskLevel
    account_id: str | None = None
    website_url: str | None = None
    evaluation_id: str | None = None
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


def _nested(payload: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    inner = payload.get(key)
    return inner if isinstance(inner, Mapping) else {}


def _account_id(payload: Mapping[str, Any]) -> str | None:
    account = payload.get("account")
    if not account:
        details = payload.get("account_details")
        account = details.get("account") if isinstance(details, Mapping) else None
    return str(account) if account else None


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
    return indicators


def _merchant_description(inner: Mapping[str, Any]) -> str | None:
    parts: list[str] = []
    names = [
        item.indicator
        for item in _parse_indicators(inner.get("indicators"))
        if item.indicator
    ]
    if names:
        parts.append("Indicators: " + ", ".join(names))
    probability = inner.get("probability")
    if probability is not None:
        parts.append(f"Probability: {probability}%")
    return ". ".join(parts) or None


def _parse_merchant_signal(payload: Mapping[str, Any]) -> AccountRiskSignal | None:
    account_id = _account_id(payload)
    if not account_id:
        return None
    inner = _nested(payload, OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT)
    return AccountRiskSignal(
        type=OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT,
        risk_level=_coerce_risk_level(inner.get("risk_level")),
        account_id=account_id,
        description=_merchant_description(inner),
        payload=dict(payload),
    )


def parse_merchant_payload(payload: Mapping[str, Any]) -> MerchantSignalPayload | None:
    """Read a stored fraudulent merchant payload, or None if it can't be used."""
    inner = _nested(payload, OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT)
    indicators = _parse_indicators(inner.get("indicators"))
    probability = _optional_float(inner.get("probability"))
    if not indicators and probability is None:
        return None

    return MerchantSignalPayload(
        indicators=indicators,
        probability=probability,
        account_id=_account_id(payload),
        signal_id=_optional_str(payload.get("id") or payload.get("signal_id")),
        evaluated_at=_optional_datetime(
            payload.get("evaluated_at") or payload.get("created")
        ),
    )


def _parse_website_signal(payload: Mapping[str, Any]) -> AccountRiskSignal | None:
    account_id = _account_id(payload)
    try:
        url = payload["account_details"]["data"]["defaults"]["profile"]["business_url"]
    except KeyError, TypeError:
        url = None
    website_url = str(url) if url else None
    evaluation_id = _optional_str(payload.get("account_evaluation"))
    if not (account_id or website_url or evaluation_id):
        return None
    inner = _nested(payload, OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE)
    details = inner.get("details")
    return AccountRiskSignal(
        type=OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE,
        risk_level=_coerce_risk_level(inner.get("risk_level")),
        account_id=account_id,
        website_url=website_url,
        evaluation_id=evaluation_id,
        description=str(details) if details is not None else None,
        payload=dict(payload),
    )


def parse_website_payload(payload: Mapping[str, Any]) -> WebsiteSignalPayload | None:
    """Read a stored fraudulent website payload, or None if it can't be used.

    ``details`` is prose: a summary, then notes citing sources as ``[n]``, then
    the numbered list of source URLs (``[1] https://example.com``). Sources that
    aren't web links stay in the text instead of becoming references, so the
    backoffice never turns them into links.
    """
    inner = _nested(payload, OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE)
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
        signal_id=_optional_str(payload.get("id") or payload.get("signal_id")),
        evaluated_at=_optional_datetime(
            payload.get("evaluated_at") or payload.get("created")
        ),
    )


def parse_account_signal(payload: Mapping[str, Any]) -> AccountRiskSignal | None:
    signal_type = payload.get("type")
    if signal_type == OrganizationRiskSignal.Type.FRAUDULENT_MERCHANT:
        return _parse_merchant_signal(payload)
    if signal_type == OrganizationRiskSignal.Type.FRAUDULENT_WEBSITE:
        return _parse_website_signal(payload)
    return None
