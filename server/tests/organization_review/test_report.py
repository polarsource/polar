"""Tests for the versioned agent report module."""

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from polar.organization_review.report import (
    LATEST_VERSION,
    AgentReportV1,
    build_agent_report,
    parse_agent_report,
)
from polar.organization_review.schemas import (
    AccountData,
    AgentReviewResult,
    DataSnapshot,
    DimensionAssessment,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    ProductsData,
    ReviewAgentReport,
    ReviewContext,
    ReviewDimension,
    ReviewVerdict,
    UsageInfo,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_review_report() -> ReviewAgentReport:
    return ReviewAgentReport(
        verdict=ReviewVerdict.APPROVE,
        overall_risk_score=15.0,
        summary="Low risk organization",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                score=10.0,
                confidence=0.9,
                findings=["All policies met"],
                recommendation="Approve",
            ),
        ],
        recommended_action="Approve without conditions",
    )


def _make_data_snapshot() -> DataSnapshot:
    return DataSnapshot(
        context=ReviewContext.SUBMISSION,
        organization=OrganizationData(name="Test Org", slug="test-org"),
        products=ProductsData(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=PaymentMetrics(),
        history=HistoryData(),
        collected_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def _make_agent_review_result() -> AgentReviewResult:
    return AgentReviewResult(
        report=_make_review_report(),
        data_snapshot=_make_data_snapshot(),
        model_used="gpt-4o-mini",
        duration_seconds=2.5,
        usage=UsageInfo(input_tokens=100, output_tokens=50, total_tokens=150),
    )


def _make_v1_report_dict(
    *,
    version: int | None = 1,
    review_type: str = "submission",
) -> dict[str, Any]:
    """Build a raw dict matching the V1 JSONB shape."""
    result = _make_agent_review_result()
    d = result.model_dump(mode="json")
    d["review_type"] = review_type
    if version is not None:
        d["version"] = version
    return d


# ---------------------------------------------------------------------------
# parse_agent_report
# ---------------------------------------------------------------------------


class TestParseAgentReport:
    def test_parses_v1_with_explicit_version(self) -> None:
        data = _make_v1_report_dict(version=1)
        parsed = parse_agent_report(data)

        assert isinstance(parsed, AgentReportV1)
        assert parsed.version == 1
        assert parsed.review_type == "submission"
        assert parsed.report.verdict == ReviewVerdict.APPROVE
        assert parsed.report.overall_risk_score == 15.0
        assert parsed.model_used == "gpt-4o-mini"
        assert parsed.duration_seconds == 2.5

    def test_parses_legacy_without_version(self) -> None:
        """Legacy rows don't have a version field — should be treated as V1."""
        data = _make_v1_report_dict(version=None)
        assert "version" not in data

        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV1)
        assert parsed.version == 1

    def test_preserves_dimensions(self) -> None:
        data = _make_v1_report_dict()
        parsed = parse_agent_report(data)

        assert len(parsed.report.dimensions) == 1
        dim = parsed.report.dimensions[0]
        assert dim.dimension == ReviewDimension.POLICY_COMPLIANCE
        assert dim.score == 10.0
        assert dim.confidence == 0.9

    def test_preserves_usage(self) -> None:
        data = _make_v1_report_dict()
        parsed = parse_agent_report(data)

        assert parsed.usage.input_tokens == 100
        assert parsed.usage.output_tokens == 50
        assert parsed.usage.total_tokens == 150

    def test_preserves_data_snapshot(self) -> None:
        data = _make_v1_report_dict()
        parsed = parse_agent_report(data)

        assert parsed.data_snapshot.context == ReviewContext.SUBMISSION
        assert parsed.data_snapshot.organization.name == "Test Org"
        assert parsed.data_snapshot.organization.slug == "test-org"

    def test_unknown_version_raises(self) -> None:
        data = _make_v1_report_dict()
        data["version"] = 999

        with pytest.raises(ValueError, match="Unknown agent report version: 999"):
            parse_agent_report(data)

    def test_invalid_data_raises_validation_error(self) -> None:
        """Missing required fields should raise a Pydantic ValidationError."""
        with pytest.raises(ValidationError):
            parse_agent_report({"version": 1, "review_type": "manual"})

    def test_roundtrip_through_model_dump(self) -> None:
        """parse(report.model_dump()) should equal the original."""
        original = AgentReportV1(
            review_type="threshold",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="gpt-4o",
            duration_seconds=3.0,
        )
        dumped = original.model_dump(mode="json")
        restored = parse_agent_report(dumped)

        assert restored == original


# ---------------------------------------------------------------------------
# build_agent_report
# ---------------------------------------------------------------------------


class TestBuildAgentReport:
    def test_builds_latest_version(self) -> None:
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="submission")

        assert isinstance(report, AgentReportV1)
        assert report.version == LATEST_VERSION
        assert report.review_type == "submission"

    def test_copies_all_fields(self) -> None:
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="threshold")

        assert report.report == result.report
        assert report.data_snapshot == result.data_snapshot
        assert report.model_used == result.model_used
        assert report.duration_seconds == result.duration_seconds
        assert report.usage == result.usage
        assert report.timed_out == result.timed_out
        assert report.error == result.error

    def test_serializes_to_valid_json(self) -> None:
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="manual")
        data = report.model_dump(mode="json")

        # Should contain version key
        assert data["version"] == 1
        assert data["review_type"] == "manual"
        # Should be parseable back
        parsed = parse_agent_report(data)
        assert parsed == report

    def test_with_error_and_timeout(self) -> None:
        result = _make_agent_review_result()
        result.timed_out = True
        result.error = "Agent timed out"

        report = build_agent_report(result, review_type="submission")
        assert report.timed_out is True
        assert report.error == "Agent timed out"


# ---------------------------------------------------------------------------
# AgentReportV1 schema
# ---------------------------------------------------------------------------


class TestAgentReportV1:
    def test_version_defaults_to_1(self) -> None:
        report = AgentReportV1(
            review_type="manual",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="test",
            duration_seconds=1.0,
        )
        assert report.version == 1

    def test_version_is_literal_1(self) -> None:
        """Cannot set version to anything other than 1."""
        with pytest.raises(ValidationError):
            AgentReportV1(
                version=2,  # type: ignore[arg-type]
                review_type="manual",
                report=_make_review_report(),
                data_snapshot=_make_data_snapshot(),
                model_used="test",
                duration_seconds=1.0,
            )

    def test_duration_defaults_to_zero(self) -> None:
        report = AgentReportV1(
            review_type="manual",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="test",
        )
        assert report.duration_seconds == 0.0

    def test_deny_verdict(self) -> None:
        review_report = _make_review_report()
        review_report.verdict = ReviewVerdict.DENY
        review_report.overall_risk_score = 85.0

        report = AgentReportV1(
            review_type="submission",
            report=review_report,
            data_snapshot=_make_data_snapshot(),
            model_used="gpt-4o",
            duration_seconds=5.0,
        )
        assert report.report.verdict == ReviewVerdict.DENY
        assert report.report.overall_risk_score == 85.0
