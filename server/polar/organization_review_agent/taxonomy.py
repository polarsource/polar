"""Central registry of ``RaisedSignal.kind`` values.

Every signal a lane emits must have a matching entry in
``SIGNAL_KIND_REGISTRY``. This is the v2 module's controlled vocabulary —
the analogue of an enum, plus per-kind metadata downstream slices rely
on (Slice 1 ``allowed_for_auto_action``, Slice 4 ``merchant_safe``).

Adding a new kind:

1. Add a constant to :class:`SignalKind` matching the snake_case ``kind``.
2. Add a :class:`SignalKindSpec` entry to ``SIGNAL_KIND_REGISTRY``.
3. Reference it from the emitting lane via ``SignalKind.<NAME>``.
4. ``test_taxonomy.py::test_registry_covers_all_kinds`` will fail if you
   forget a registry entry.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType


class SignalDimension(StrEnum):
    """High-level concern area a signal belongs to.

    Mirrors the legacy ``polar.organization_review.schemas.ReviewDimension``
    so reports stay legible across v1 and v2.
    """

    POLICY_COMPLIANCE = "policy_compliance"
    PRODUCT_LEGITIMACY = "product_legitimacy"
    IDENTITY_TRUST = "identity_trust"
    FINANCIAL_RISK = "financial_risk"
    PRIOR_HISTORY = "prior_history"
    SETUP_READINESS = "setup_readiness"


class Severity(StrEnum):
    """Severity of an individual signal.

    Distinct from per-dimension ``RiskLevel`` so a single signal can
    contribute to a higher-or-lower dimension assessment based on
    surrounding context, prior memory, and merchant facets.
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class SignalKind(StrEnum):
    """All ``RaisedSignal.kind`` values the v2 agent may emit.

    Keep entries in alphabetical order. The string value is the
    snake_case stored representation; the member name is the import-time
    identifier lanes reference.
    """

    CHARGES_OR_PAYOUTS_DISABLED = "charges_or_payouts_disabled"
    CUSTOM_PRICING_OVERUSE = "custom_pricing_overuse"
    HIGH_DISPUTE_RATE = "high_dispute_rate"
    HIGH_P50_RISK_SCORE = "high_p50_risk_score"
    HIGH_P90_RISK_SCORE = "high_p90_risk_score"
    HIGH_REFUND_RATE = "high_refund_rate"
    HUMAN_OVERRIDE_HISTORY = "human_override_history"
    IDENTITY_NOT_VERIFIED = "identity_not_verified"
    MERCHANT_DECLARATION_MISMATCH = "merchant_declaration_mismatch"
    NO_DELIVERY_MECHANISM = "no_delivery_mechanism"
    PAYOUT_REQUIREMENTS_PAST_DUE = "payout_requirements_past_due"
    PRIOR_BLOCKS_PRESENT = "prior_blocks_present"
    PRIOR_DENIALS_PRESENT = "prior_denials_present"
    REDIRECT_TO_OTHER_DOMAIN = "redirect_to_other_domain"
    USER_BLOCKED = "user_blocked"


@dataclass(frozen=True, slots=True)
class SignalKindSpec:
    """Per-kind metadata that downstream slices predicate on.

    Attributes:
        kind: The :class:`SignalKind` this spec describes.
        dimension: Which dimension this kind contributes to.
        default_severity: Severity emitted when a lane does not override.
            Lanes may emit at higher or lower severity based on local
            evidence (a tiny refund rate is LOW, a 50% refund rate is
            HIGH); this is the fallback when the lane stays neutral.
        merchant_safe: Whether the human-readable description may be
            shown verbatim on the merchant Case page (Slice 4). Default
            False — opt-in only after the per-kind audit Slice 4 mandates.
        owner_lane: Snake_case name of the lane responsible for emitting
            this kind. Slice 0's ``test_one_owner_per_kind`` enforces a
            single owner.
        allowed_for_auto_action: Whether a clean state of this kind may
            participate in Slice 1's APPROVE auto-take heuristic. Default
            False — opt-in. Kinds that are noisy / low-precision should
            stay False so a single noisy lane can't open the auto-take
            quadrant.
        human_disclosure_template: Format-string for the merchant-facing
            wording. Used by Slice 4 only when ``merchant_safe`` is True.
            ``{org}`` is the merchant's display name; lanes may use
            additional placeholders by passing them in the signal's
            ``evidence`` mapping.
    """

    kind: SignalKind
    dimension: SignalDimension
    default_severity: Severity
    owner_lane: str
    merchant_safe: bool = False
    allowed_for_auto_action: bool = False
    human_disclosure_template: str | None = None


_REGISTRY: dict[SignalKind, SignalKindSpec] = {}


def _register(spec: SignalKindSpec) -> None:
    if spec.kind in _REGISTRY:
        raise RuntimeError(
            f"Duplicate registration for SignalKind.{spec.kind.name}; "
            f"each kind may only appear once in the registry."
        )
    _REGISTRY[spec.kind] = spec


# Setup-readiness lane signals -------------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.CHARGES_OR_PAYOUTS_DISABLED,
        dimension=SignalDimension.SETUP_READINESS,
        default_severity=Severity.HIGH,
        owner_lane="payout_account",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.PAYOUT_REQUIREMENTS_PAST_DUE,
        dimension=SignalDimension.SETUP_READINESS,
        default_severity=Severity.MEDIUM,
        owner_lane="payout_account",
        merchant_safe=True,
        human_disclosure_template=(
            "Your payout account is missing required information."
        ),
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.NO_DELIVERY_MECHANISM,
        dimension=SignalDimension.SETUP_READINESS,
        default_severity=Severity.MEDIUM,
        owner_lane="products",
    )
)

# Identity-trust lane signals --------------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.IDENTITY_NOT_VERIFIED,
        dimension=SignalDimension.IDENTITY_TRUST,
        default_severity=Severity.MEDIUM,
        owner_lane="identity",
        merchant_safe=True,
        human_disclosure_template=(
            "We weren't able to verify your identity yet."
        ),
    )
)

# Prior-history lane signals ---------------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.USER_BLOCKED,
        dimension=SignalDimension.PRIOR_HISTORY,
        default_severity=Severity.HIGH,
        owner_lane="history",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.PRIOR_DENIALS_PRESENT,
        dimension=SignalDimension.PRIOR_HISTORY,
        default_severity=Severity.MEDIUM,
        owner_lane="history",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.PRIOR_BLOCKS_PRESENT,
        dimension=SignalDimension.PRIOR_HISTORY,
        default_severity=Severity.HIGH,
        owner_lane="history",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.HUMAN_OVERRIDE_HISTORY,
        dimension=SignalDimension.PRIOR_HISTORY,
        default_severity=Severity.LOW,
        owner_lane="history",
    )
)

# Financial-risk lane signals --------------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.HIGH_REFUND_RATE,
        dimension=SignalDimension.FINANCIAL_RISK,
        default_severity=Severity.MEDIUM,
        owner_lane="payments",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.HIGH_DISPUTE_RATE,
        dimension=SignalDimension.FINANCIAL_RISK,
        default_severity=Severity.HIGH,
        owner_lane="payments",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.HIGH_P50_RISK_SCORE,
        dimension=SignalDimension.FINANCIAL_RISK,
        default_severity=Severity.MEDIUM,
        owner_lane="payments",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.HIGH_P90_RISK_SCORE,
        dimension=SignalDimension.FINANCIAL_RISK,
        default_severity=Severity.HIGH,
        owner_lane="payments",
    )
)

# Product-legitimacy lane signals ----------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.CUSTOM_PRICING_OVERUSE,
        dimension=SignalDimension.PRODUCT_LEGITIMACY,
        default_severity=Severity.LOW,
        owner_lane="products",
    )
)
_register(
    SignalKindSpec(
        kind=SignalKind.MERCHANT_DECLARATION_MISMATCH,
        dimension=SignalDimension.PRODUCT_LEGITIMACY,
        default_severity=Severity.MEDIUM,
        owner_lane="categorisation",
    )
)

# Policy-compliance lane signals -----------------------------------------------

_register(
    SignalKindSpec(
        kind=SignalKind.REDIRECT_TO_OTHER_DOMAIN,
        dimension=SignalDimension.POLICY_COMPLIANCE,
        default_severity=Severity.HIGH,
        owner_lane="website",
    )
)


SIGNAL_KIND_REGISTRY: Mapping[SignalKind, SignalKindSpec] = MappingProxyType(
    _REGISTRY
)
"""Read-only view of the registry. Lanes and tests import this directly."""


def spec_for(kind: SignalKind) -> SignalKindSpec:
    """Look up a kind's spec, raising if absent.

    Wrapper for the common case so call sites read naturally:

    >>> spec_for(SignalKind.HIGH_DISPUTE_RATE).default_severity
    <Severity.HIGH: 'high'>
    """

    try:
        return SIGNAL_KIND_REGISTRY[kind]
    except KeyError as exc:
        raise KeyError(
            f"SignalKind.{kind.name} is not registered in "
            f"SIGNAL_KIND_REGISTRY. Add a SignalKindSpec entry in "
            f"polar/organization_review_agent/taxonomy.py."
        ) from exc
