"""Versioned, type-safe schemas for OrganizationAgentReview.report JSONB.

Every report stored in the ``organization_agent_reviews.report`` column MUST
carry a ``version`` integer so that readers can deserialize it into the correct
Pydantic model.  Legacy rows written before versioning was introduced are
treated as V1.

Adding a new version
--------------------
1. Define ``AgentReportV2(Schema)`` with ``version: Literal[2] = 2``.
2. Add it to the ``AnyAgentReport`` union.
3. Handle it in ``parse_agent_report``.
4. Update ``LATEST_VERSION`` and ``LatestAgentReport``.
"""

from typing import Any, Literal

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
    "AnyAgentReport",
    "LatestAgentReport",
    "build_agent_report",
    "parse_agent_report",
]

# ---------------------------------------------------------------------------
# Version 1
# ---------------------------------------------------------------------------

LATEST_VERSION: Literal[1] = 1


class AgentReportV1(Schema):
    """Version 1 of the persisted agent review report.

    Matches the structure that was written to JSONB before versioning was added,
    plus an explicit ``version`` field.  Fields mirror ``AgentReviewResult`` with
    the addition of ``review_type`` (injected at save time).
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
# Union of all versions
# ---------------------------------------------------------------------------

AnyAgentReport = AgentReportV1  # Union[AgentReportV1, AgentReportV2, ...] in the future
LatestAgentReport = AgentReportV1


# ---------------------------------------------------------------------------
# Parse (read path)
# ---------------------------------------------------------------------------


def parse_agent_report(data: dict[str, Any]) -> AnyAgentReport:
    """Deserialize a raw JSONB dict into a versioned report schema.

    Legacy rows without a ``version`` key are treated as V1.

    Raises ``ValueError`` for unknown versions and ``ValidationError`` for
    data that doesn't match the expected schema.
    """
    version = data.get("version")
    if version is None or version == 1:
        return AgentReportV1.model_validate(data)

    raise ValueError(f"Unknown agent report version: {version}")


# ---------------------------------------------------------------------------
# Build (write path)
# ---------------------------------------------------------------------------


def build_agent_report(
    result: AgentReviewResult,
    review_type: str,
) -> AgentReportV1:
    """Construct a ``LatestAgentReport`` from an ``AgentReviewResult``.

    This is the single place where we build the report dict that gets persisted.
    """
    return AgentReportV1(
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
