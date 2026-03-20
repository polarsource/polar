"""Typed, extensible risk storage for organizations.

Each organization can have zero or more risks stored as a JSONB array in the
``Organization.risks`` column.  Every risk entry carries a ``type`` discriminator
so Pydantic can deserialize into the correct typed model.

Adding a new risk type
----------------------
1. Define a new ``XxxRisk(BaseRisk)`` with ``type: Literal["xxx"] = "xxx"``.
2. Add it to the ``AnyRisk`` union.
3. (Optional) add a detection helper or backoffice UI for it.

The ``type`` discriminator makes the schema forward-compatible: unknown types
are preserved as raw dicts on read so old code doesn't crash when new types
are added.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import Discriminator, Field, Tag

from polar.kit.schemas import Schema


# ---------------------------------------------------------------------------
# Shared enums
# ---------------------------------------------------------------------------


class RiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskCategory(StrEnum):
    """Top-level grouping for risk types."""

    GEOGRAPHIC = "geographic"
    FINANCIAL = "financial"
    IDENTITY = "identity"
    COMPLIANCE = "compliance"
    BEHAVIORAL = "behavioral"
    MANUAL = "manual"


# ---------------------------------------------------------------------------
# Base risk model
# ---------------------------------------------------------------------------


class BaseRisk(Schema):
    """Common fields shared by all risk types."""

    type: str = Field(description="Discriminator — set by each subclass")
    category: RiskCategory = Field(description="Top-level risk grouping")
    level: RiskLevel = Field(description="Severity of this risk")
    title: str = Field(description="Short human-readable label")
    description: str | None = Field(
        default=None, description="Longer explanation shown in backoffice"
    )
    detected_at: datetime = Field(description="When this risk was first identified")
    source: str = Field(
        default="system",
        description="Who created this risk: 'system', 'agent', or a user email",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary key-value pairs for type-specific extras",
    )


# ---------------------------------------------------------------------------
# Concrete risk types
# ---------------------------------------------------------------------------


class CountryRisk(BaseRisk):
    """High-risk or sanctioned country on the merchant account."""

    type: Literal["country"] = "country"
    category: RiskCategory = RiskCategory.GEOGRAPHIC
    country_code: str = Field(description="ISO 3166-1 alpha-2 country code")
    country_name: str | None = Field(
        default=None, description="Human-readable country name"
    )


class CurrencyRisk(BaseRisk):
    """Unusual or high-risk payout currency."""

    type: Literal["currency"] = "currency"
    category: RiskCategory = RiskCategory.GEOGRAPHIC
    currency_code: str = Field(description="ISO 4217 currency code")


class PaymentMetricRisk(BaseRisk):
    """A payment health metric has breached a warning or critical threshold."""

    type: Literal["payment_metric"] = "payment_metric"
    category: RiskCategory = RiskCategory.FINANCIAL
    metric_name: str = Field(
        description="e.g. dispute_rate, chargeback_rate, refund_rate, auth_rate"
    )
    metric_value: float = Field(description="Current value of the metric")
    threshold_level: str = Field(description="'warn' or 'crit'")
    threshold_value: float = Field(
        description="The threshold that was breached"
    )


class IdentityRisk(BaseRisk):
    """Identity verification issue from Stripe or internal checks."""

    type: Literal["identity"] = "identity"
    category: RiskCategory = RiskCategory.IDENTITY
    verification_status: str | None = Field(
        default=None, description="e.g. 'unverified', 'pending', 'failed'"
    )
    error_code: str | None = Field(
        default=None, description="Stripe verification error code"
    )


class ComplianceRisk(BaseRisk):
    """Policy or TOS compliance concern identified by AI or human review."""

    type: Literal["compliance"] = "compliance"
    category: RiskCategory = RiskCategory.COMPLIANCE
    violated_sections: list[str] = Field(
        default_factory=list,
        description="Policy sections that were violated",
    )
    review_dimension: str | None = Field(
        default=None,
        description="AI review dimension: policy_compliance, product_legitimacy, etc.",
    )


class VelocityRisk(BaseRisk):
    """Unusual transaction velocity or volume patterns."""

    type: Literal["velocity"] = "velocity"
    category: RiskCategory = RiskCategory.BEHAVIORAL
    metric_name: str = Field(
        description="e.g. 'txn_volume_24h', 'new_customers_1h'"
    )
    observed_value: float = Field(description="The observed value")
    expected_range: str | None = Field(
        default=None, description="Human-readable expected range"
    )


class ManualRisk(BaseRisk):
    """Risk flag added manually by a backoffice reviewer."""

    type: Literal["manual"] = "manual"
    category: RiskCategory = RiskCategory.MANUAL
    added_by: str | None = Field(
        default=None, description="Email of the reviewer who added this"
    )
    notes: str | None = Field(
        default=None, description="Free-form reviewer notes"
    )


# ---------------------------------------------------------------------------
# Discriminated union
# ---------------------------------------------------------------------------


def _get_risk_discriminator(v: Any) -> str:
    if isinstance(v, dict):
        return v.get("type", "manual")
    return getattr(v, "type", "manual")


AnyRisk = Annotated[
    Annotated[CountryRisk, Tag("country")]
    | Annotated[CurrencyRisk, Tag("currency")]
    | Annotated[PaymentMetricRisk, Tag("payment_metric")]
    | Annotated[IdentityRisk, Tag("identity")]
    | Annotated[ComplianceRisk, Tag("compliance")]
    | Annotated[VelocityRisk, Tag("velocity")]
    | Annotated[ManualRisk, Tag("manual")],
    Discriminator(_get_risk_discriminator),
]


# ---------------------------------------------------------------------------
# Container schema (what gets stored in the JSONB column)
# ---------------------------------------------------------------------------


class OrganizationRisks(Schema):
    """Top-level container stored in ``Organization.risks``."""

    version: int = Field(default=1, description="Schema version for future migrations")
    entries: list[AnyRisk] = Field(
        default_factory=list, description="All active risks for this organization"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_risks(raw: dict[str, Any] | None) -> OrganizationRisks:
    """Deserialize raw JSONB into typed risk container.

    Returns an empty container if the column is NULL or empty.
    """
    if not raw:
        return OrganizationRisks()
    return OrganizationRisks.model_validate(raw)


def add_risk(current: OrganizationRisks, risk: AnyRisk) -> OrganizationRisks:
    """Return a new container with the risk appended (immutable)."""
    return OrganizationRisks(
        version=current.version,
        entries=[*current.entries, risk],
    )


def remove_risk_by_type(
    current: OrganizationRisks, risk_type: str
) -> OrganizationRisks:
    """Return a new container with all risks of the given type removed."""
    return OrganizationRisks(
        version=current.version,
        entries=[r for r in current.entries if r.type != risk_type],
    )


def remove_risk_by_index(
    current: OrganizationRisks, index: int
) -> OrganizationRisks:
    """Return a new container with the risk at the given index removed."""
    entries = list(current.entries)
    if 0 <= index < len(entries):
        entries.pop(index)
    return OrganizationRisks(version=current.version, entries=entries)


def has_risk_of_type(risks: OrganizationRisks, risk_type: str) -> bool:
    """Check if any risk of the given type exists."""
    return any(r.type == risk_type for r in risks.entries)


def highest_risk_level(risks: OrganizationRisks) -> RiskLevel | None:
    """Return the highest risk level across all entries, or None if empty."""
    if not risks.entries:
        return None
    severity = {
        RiskLevel.LOW: 0,
        RiskLevel.MEDIUM: 1,
        RiskLevel.HIGH: 2,
        RiskLevel.CRITICAL: 3,
    }
    return max(risks.entries, key=lambda r: severity[r.level]).level
