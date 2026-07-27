"""Stripe Radar for Platforms account risk signals (private preview).

Normalizes the two live signals (fraudulent website, fraudulent merchant) into
one small shape. Both arrive as thin events; the full event (fetched by id)
carries the fields under ``data``, but each signal nests them differently.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from polar.models.organization_risk_signal import OrganizationRiskSignal


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
