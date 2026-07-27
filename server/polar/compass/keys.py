"""
The deterministic insight key: `detector_id:organization_id:period_bucket`.

Insights are computed live and never persisted, so this key is the only stable
handle on one — feedback rows reference it, and a recomputed insight re-attaches
to prior feedback through it. Encoding and parsing live together here so the two
sides can't drift.
"""

import uuid
from dataclasses import dataclass

_SEPARATOR = ":"
_PARTS = 3


@dataclass(frozen=True)
class ParsedInsightKey:
    detector_id: str
    organization_id: uuid.UUID
    period_bucket: str


def build_insight_key(
    detector_id: str, organization_id: uuid.UUID, period_bucket: str
) -> str:
    if _SEPARATOR in detector_id or _SEPARATOR in period_bucket:
        raise ValueError(
            "Detector ids and period buckets must not contain the key separator."
        )
    return _SEPARATOR.join((detector_id, str(organization_id), period_bucket))


def parse_insight_key(key: str) -> ParsedInsightKey:
    parts = key.split(_SEPARATOR)
    if len(parts) != _PARTS:
        raise ValueError("Malformed insight key.")
    detector_id, raw_organization_id, period_bucket = parts
    if not detector_id or not period_bucket:
        raise ValueError("Malformed insight key.")
    try:
        organization_id = uuid.UUID(raw_organization_id)
    except ValueError as e:
        raise ValueError("Malformed insight key.") from e
    return ParsedInsightKey(
        detector_id=detector_id,
        organization_id=organization_id,
        period_bucket=period_bucket,
    )
