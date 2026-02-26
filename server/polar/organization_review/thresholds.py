"""Shared payment metric thresholds for organization reviews.

Used by both the AI review agent (prompts) and the backoffice UI
to ensure consistent evaluation criteria.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class MetricThreshold:
    """A single metric's warning/critical thresholds."""

    label: str
    warn: float
    crit: float
    higher_is_worse: bool = True
    unit: str = "%"

    @property
    def direction(self) -> Literal["above", "below"]:
        return "above" if self.higher_is_worse else "below"

    def evaluate(self, value: float) -> Literal["ok", "warn", "crit"]:
        if self.higher_is_worse:
            if value >= self.crit:
                return "crit"
            if value >= self.warn:
                return "warn"
            return "ok"
        # Lower-is-worse (e.g. auth rate)
        if value <= self.crit:
            return "crit"
        if value <= self.warn:
            return "warn"
        return "ok"

    def prompt_description(self) -> str:
        """Human-readable threshold description for AI prompts."""
        op = ">" if self.higher_is_worse else "<"
        u = self.unit
        return f"{self.label}: {op} {self.warn}{u} warn, {op} {self.crit}{u} crit"


# -- Threshold definitions (single source of truth) --

AUTH_RATE = MetricThreshold(label="Auth Rate", warn=90, crit=75, higher_is_worse=False)
REFUND_RATE = MetricThreshold(label="Refund Rate", warn=10, crit=15)
DISPUTE_RATE = MetricThreshold(label="Dispute Rate", warn=0.50, crit=0.75)
CHARGEBACK_RATE = MetricThreshold(label="Chargeback Rate", warn=0.15, crit=0.30)
P50_RISK = MetricThreshold(label="P50 Risk Score", warn=50, crit=65, unit="")
P90_RISK = MetricThreshold(label="P90 Risk Score", warn=65, crit=75, unit="")

ALL_THRESHOLDS = [
    AUTH_RATE,
    REFUND_RATE,
    DISPUTE_RATE,
    CHARGEBACK_RATE,
    P50_RISK,
    P90_RISK,
]


def thresholds_for_prompt() -> str:
    """Format all thresholds as a block for inclusion in AI prompts."""
    lines = [t.prompt_description() for t in ALL_THRESHOLDS]
    return "\n".join(f"- {line}" for line in lines)
