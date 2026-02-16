from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from polar.kit.utils import utc_now


@dataclass
class TimeframeMetrics:
    """Metrics for a specific timeframe (30d or all-time)."""

    auth_rate: float | None = None
    payment_count: int = 0
    payment_attempt_count: int = 0
    refund_rate: float | None = None
    refund_count: int = 0
    p90_risk_score: float | None = None
    dispute_rate: float | None = None
    dispute_count: int = 0
    chargeback_rate: float | None = None
    chargeback_count: int = 0

    def to_json(self, calculated_at: datetime) -> dict[str, Any]:
        """Convert metrics to JSON for JSONB storage."""
        return {
            "auth_rate": self.auth_rate,
            "payment_count": self.payment_count,
            "payment_attempt_count": self.payment_attempt_count,
            "refund_rate": self.refund_rate,
            "refund_count": self.refund_count,
            "p90_risk_score": self.p90_risk_score,
            "dispute_rate": self.dispute_rate,
            "dispute_count": self.dispute_count,
            "chargeback_rate": self.chargeback_rate,
            "chargeback_count": self.chargeback_count,
            "calculated_at": calculated_at.isoformat(),
        }


@dataclass
class RiskStats:
    """Container for calculated risk metrics across timeframes."""

    last_30d: TimeframeMetrics = field(default_factory=TimeframeMetrics)
    all_time: TimeframeMetrics = field(default_factory=TimeframeMetrics)
    calculated_at: datetime = field(default_factory=utc_now)

    def to_30d_json(self) -> dict[str, Any]:
        """Convert 30-day metrics to JSON for JSONB storage."""
        return self.last_30d.to_json(self.calculated_at)

    def to_all_time_json(self) -> dict[str, Any]:
        """Convert all-time metrics to JSON for JSONB storage."""
        return self.all_time.to_json(self.calculated_at)


@dataclass
class ThresholdOverride:
    """Override for a specific risk threshold."""

    value: float
    expires_at: datetime | None
    set_at: datetime
    set_by_user_id: str | None
    reason: str | None

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return utc_now() > self.expires_at

    def to_json(self) -> dict[str, Any]:
        return {
            "value": self.value,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "set_at": self.set_at.isoformat(),
            "set_by_user_id": self.set_by_user_id,
            "reason": self.reason,
        }

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "ThresholdOverride":
        return cls(
            value=data["value"],
            expires_at=(
                datetime.fromisoformat(data["expires_at"])
                if data.get("expires_at")
                else None
            ),
            set_at=datetime.fromisoformat(data["set_at"]),
            set_by_user_id=data.get("set_by_user_id"),
            reason=data.get("reason"),
        )
