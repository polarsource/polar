"""Versioned, type-safe schemas for OrganizationAgentReview.report JSONB.

Every report stored in the ``organization_agent_reviews.report`` column MUST
carry a ``version`` integer so that readers can deserialize it into the correct
Pydantic model.  Legacy rows written before versioning was introduced are
treated as V1.

Adding a new version
--------------------
1. Define ``AgentReportVN(Schema)`` with ``version: Literal[N] = N``.
2. Add it to the ``AnyAgentReport`` union.
3. Handle it in ``parse_agent_report``.
4. Update ``LATEST_VERSION`` and ``LatestAgentReport``.

Version history
---------------
V1: Original format. DimensionAssessment originally had ``score: float`` and
    ReviewAgentReport had an explicit ``overall_risk_score: float``.  Both were
    replaced in-place with risk_level enums and computed fields.

V2: Adds ``overall_risk_level`` as an explicit LLM-output field on
    ReviewAgentReport.  ``parse_agent_report`` always returns V2 — V1 rows are
    migrated on read via ``_migrate_v1_to_v2``.
"""

from typing import Any, Literal

from pydantic import Field

from polar.kit.schemas import Schema

from .schemas import (
    AgentReviewResult,
    DataSnapshot,
    DimensionAssessment,
    ReviewAgentReport,
    ReviewDimension,
    ReviewVerdict,
    RiskLevel,
    UsageInfo,
)

__all__ = [
    "LATEST_VERSION",
    "AgentReportV1",
    "AgentReportV2",
    "AnyAgentReport",
    "LatestAgentReport",
    "build_agent_report",
    "parse_agent_report",
]

# ---------------------------------------------------------------------------
# Version 1 — legacy types (only used for parsing old DB rows)
# ---------------------------------------------------------------------------


class DimensionAssessmentV1(Schema):
    """V1 dimension: may have a float ``score`` instead of ``risk_level``."""

    dimension: ReviewDimension
    score: float | None = None
    risk_level: RiskLevel | None = None
    confidence: float
    findings: list[str] = Field(default_factory=list)
    recommendation: str


class ReviewAgentReportV1(Schema):
    """V1 report: has ``overall_risk_score`` float, no ``overall_risk_level``."""

    verdict: ReviewVerdict
    summary: str
    merchant_summary: str = ""
    violated_sections: list[str] = Field(default_factory=list)
    dimensions: list[DimensionAssessmentV1]
    overall_risk_score: float | None = None
    recommended_action: str


class AgentReportV1(Schema):
    """Version 1 of the persisted agent review report.

    Matches the structure that was written to JSONB before versioning was added,
    plus an explicit ``version`` field.  The inner ``report`` uses V1-specific
    types that accept the old float-score format.
    """

    version: Literal[1] = 1

    review_type: str | None = Field(
        default=None,
        description="Review trigger context: submission, setup_complete, threshold, manual",
    )

    report: ReviewAgentReportV1 = Field(description="The core AI analysis output")
    data_snapshot: DataSnapshot = Field(
        description="All collected data that was fed to the analyzer"
    )
    model_used: str = Field(description="AI model identifier")
    duration_seconds: float = Field(
        default=0.0, description="Wall-clock time for the review"
    )
    usage: UsageInfo = Field(default_factory=UsageInfo)
    timed_out: bool = False
    error: str | None = None


# ---------------------------------------------------------------------------
# Version 2
# ---------------------------------------------------------------------------


class AgentReportV2(Schema):
    """Version 2 of the persisted agent review report.

    Identical structure to V1 but written by code that includes
    ``overall_risk_level`` as an explicit LLM-output field on the inner
    ``ReviewAgentReport``.
    """

    version: Literal[2] = 2

    review_type: str = Field(
        description="Review trigger context: submission, setup_complete, threshold, manual"
    )

    report: ReviewAgentReport = Field(description="The core AI analysis output")
    data_snapshot: DataSnapshot = Field(
        description="All collected data that was fed to the analyzer"
    )
    model_used: str = Field(description="AI model identifier")
    duration_seconds: float = Field(
        default=0.0, description="Wall-clock time for the review"
    )
    usage: UsageInfo = Field(default_factory=UsageInfo)
    timed_out: bool = False
    error: str | None = None


# ---------------------------------------------------------------------------
# Migration helpers
# ---------------------------------------------------------------------------


def _score_to_risk_level(score: float) -> RiskLevel:
    if score < 30:
        return RiskLevel.LOW
    if score < 70:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _migrate_dimension(d: DimensionAssessmentV1) -> DimensionAssessment:
    risk_level = d.risk_level
    if risk_level is None and d.score is not None:
        risk_level = _score_to_risk_level(d.score)
    if risk_level is None:
        risk_level = RiskLevel.MEDIUM
    return DimensionAssessment(
        dimension=d.dimension,
        risk_level=risk_level,
        confidence=d.confidence,
        findings=d.findings,
        recommendation=d.recommendation,
    )


def _migrate_report(r: ReviewAgentReportV1) -> ReviewAgentReport:
    dimensions = [_migrate_dimension(d) for d in r.dimensions]
    levels = [d.risk_level for d in dimensions]
    if RiskLevel.HIGH in levels:
        overall = RiskLevel.HIGH
    elif RiskLevel.MEDIUM in levels:
        overall = RiskLevel.MEDIUM
    elif levels:
        overall = RiskLevel.LOW
    else:
        overall = RiskLevel.MEDIUM
    return ReviewAgentReport(
        verdict=r.verdict,
        summary=r.summary,
        merchant_summary=r.merchant_summary,
        violated_sections=r.violated_sections,
        dimensions=dimensions,
        overall_risk_level=overall,
        recommended_action=r.recommended_action,
    )


def _migrate_v1_to_v2(v1: AgentReportV1) -> AgentReportV2:
    """Migrate a V1 report to V2 with type-safe conversion."""
    return AgentReportV2(
        report=_migrate_report(v1.report),
        review_type=v1.review_type,  # type: ignore[arg-type]
        data_snapshot=v1.data_snapshot,
        model_used=v1.model_used,
        duration_seconds=v1.duration_seconds,
        usage=v1.usage,
        timed_out=v1.timed_out,
        error=v1.error,
    )


# ---------------------------------------------------------------------------
# Public type aliases
# ---------------------------------------------------------------------------

LATEST_VERSION: Literal[2] = 2

# V1 is always migrated on read, so both aliases resolve to AgentReportV2.
# AnyAgentReport is kept as the public API for callers that accept any version
# (repository, model property, views); LatestAgentReport for write-path code.
LatestAgentReport = AgentReportV2
AnyAgentReport = LatestAgentReport


# ---------------------------------------------------------------------------
# Parse (read path) — always returns LatestAgentReport (V2)
# ---------------------------------------------------------------------------


def parse_agent_report(data: dict[str, Any]) -> LatestAgentReport:
    """Deserialize a raw JSONB dict into the latest report schema.

    Legacy rows without a ``version`` key are treated as V1 and migrated to V2.
    V1 rows are parsed then migrated. V2 rows are parsed directly.

    Raises ``ValueError`` for unknown versions and ``ValidationError`` for
    data that doesn't match the expected schema.
    """
    version = data.get("version")
    if version is None or version == 1:
        v1 = AgentReportV1.model_validate(data)
        return _migrate_v1_to_v2(v1)
    if version == 2:
        return AgentReportV2.model_validate(data)

    raise ValueError(f"Unknown agent report version: {version}")


# ---------------------------------------------------------------------------
# Build (write path)
# ---------------------------------------------------------------------------


def build_agent_report(
    result: AgentReviewResult,
    review_type: str,
) -> AgentReportV2:
    """Construct a ``LatestAgentReport`` from an ``AgentReviewResult``.

    This is the single place where we build the report dict that gets persisted.
    """
    return AgentReportV2(
        version=LATEST_VERSION,
        review_type=review_type,
        report=result.report,
        data_snapshot=result.data_snapshot,
        model_used=result.model_used,
        duration_seconds=result.duration_seconds,
        usage=result.usage,
        timed_out=result.timed_out,
        error=result.error,
    )
