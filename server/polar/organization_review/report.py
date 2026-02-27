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

from typing import Any, Literal, Union

from pydantic import Field

from polar.kit.schemas import Schema

from .schemas import (
    AgentReviewResult,
    DataSnapshot,
    ReviewAgentReport,
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
# Version 1
# ---------------------------------------------------------------------------


class AgentReportV1(Schema):
    """Version 1 of the persisted agent review report.

    Matches the structure that was written to JSONB before versioning was added,
    plus an explicit ``version`` field.  Fields mirror ``AgentReviewResult`` with
    the addition of ``review_type`` (injected at save time).

    DimensionAssessment originally had ``score: float`` and ReviewAgentReport
    had an explicit ``overall_risk_score: float``.  The current schemas handle
    backward-compat via model validators that convert scores → RiskLevel and
    derive overall_risk_score from dimension risk levels.
    """

    version: Literal[1] = 1

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


def _migrate_v1_to_v2(v1: AgentReportV1) -> AgentReportV2:
    """Migrate a V1 report to V2.

    The inner ``ReviewAgentReport`` already handles backfilling
    ``overall_risk_level`` from dimensions via its model validator, so we
    just need to copy fields across and set version=2.
    """
    return AgentReportV2(
        version=2,
        review_type=v1.review_type,
        report=v1.report,
        data_snapshot=v1.data_snapshot,
        model_used=v1.model_used,
        duration_seconds=v1.duration_seconds,
        usage=v1.usage,
        timed_out=v1.timed_out,
        error=v1.error,
    )


# ---------------------------------------------------------------------------
# Union of all versions
# ---------------------------------------------------------------------------

LATEST_VERSION: Literal[2] = 2

AnyAgentReport = Union[AgentReportV1, AgentReportV2]
LatestAgentReport = AgentReportV2


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
