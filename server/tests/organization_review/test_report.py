"""Tests for the versioned agent report module."""

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import ValidationError

from polar.organization_review.report import (
    LATEST_VERSION,
    AgentReportV2,
    build_agent_report,
    parse_agent_report,
)
from polar.organization_review.schemas import (
    RISK_LEVEL_SCORES,
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
    RiskLevel,
    UsageInfo,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_review_report(
    *,
    overall_risk_level: RiskLevel = RiskLevel.LOW,
) -> ReviewAgentReport:
    return ReviewAgentReport(
        verdict=ReviewVerdict.APPROVE,
        summary="Low risk organization",
        violated_sections=[],
        dimensions=[
            DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                risk_level=RiskLevel.LOW,
                confidence=0.9,
                findings=["All policies met"],
                recommendation="Approve",
            ),
        ],
        overall_risk_level=overall_risk_level,
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


def _make_v2_report_dict(
    *,
    review_type: str = "submission",
) -> dict[str, Any]:
    """Build a raw dict matching the V2 JSONB shape."""
    result = _make_agent_review_result()
    d = result.model_dump(mode="json")
    d["review_type"] = review_type
    d["version"] = 2
    return d


# ---------------------------------------------------------------------------
# parse_agent_report — always returns V2
# ---------------------------------------------------------------------------


class TestParseAgentReport:
    def test_parses_v1_returns_v2(self) -> None:
        data = _make_v1_report_dict(version=1)
        parsed = parse_agent_report(data)

        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2
        assert parsed.review_type == "submission"
        assert parsed.report.verdict == ReviewVerdict.APPROVE
        assert parsed.report.overall_risk_level == RiskLevel.LOW
        assert parsed.report.overall_risk_score == RISK_LEVEL_SCORES[RiskLevel.LOW]
        assert parsed.model_used == "gpt-4o-mini"
        assert parsed.duration_seconds == 2.5

    def test_parses_legacy_without_version_returns_v2(self) -> None:
        """Legacy rows don't have a version field — should be migrated to V2."""
        data = _make_v1_report_dict(version=None)
        assert "version" not in data

        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2

    def test_parses_v2_directly(self) -> None:
        data = _make_v2_report_dict()
        parsed = parse_agent_report(data)

        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2
        assert parsed.report.verdict == ReviewVerdict.APPROVE

    def test_preserves_dimensions(self) -> None:
        data = _make_v1_report_dict()
        parsed = parse_agent_report(data)

        assert len(parsed.report.dimensions) == 1
        dim = parsed.report.dimensions[0]
        assert dim.dimension == ReviewDimension.POLICY_COMPLIANCE
        assert dim.risk_level == RiskLevel.LOW
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

    def test_v2_roundtrip_through_model_dump(self) -> None:
        """parse(report.model_dump()) should return V2."""
        original = AgentReportV2(
            review_type="threshold",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="gpt-4o",
            duration_seconds=3.0,
        )
        dumped = original.model_dump(mode="json")
        restored = parse_agent_report(dumped)

        assert restored == original

    def test_parses_v1_with_float_scores(self) -> None:
        """V1 data with float scores should be migrated to risk levels and V2."""
        data = _make_v1_report_dict(version=1)
        # Inject old-style float score into dimensions
        data["report"]["dimensions"][0].pop("risk_level", None)
        data["report"]["dimensions"][0]["score"] = 10.0
        # Inject old-style overall_risk_score
        data["report"]["overall_risk_score"] = 15.0
        # Remove overall_risk_level so backfill kicks in
        data["report"].pop("overall_risk_level", None)

        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        dim = parsed.report.dimensions[0]
        assert dim.risk_level == RiskLevel.LOW
        # overall_risk_level backfilled from dimensions
        assert parsed.report.overall_risk_level == RiskLevel.LOW
        # overall_risk_score is computed from overall_risk_level
        assert parsed.report.overall_risk_score == RISK_LEVEL_SCORES[RiskLevel.LOW]


# ---------------------------------------------------------------------------
# build_agent_report
# ---------------------------------------------------------------------------


class TestBuildAgentReport:
    def test_builds_latest_version(self) -> None:
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="submission")

        assert isinstance(report, AgentReportV2)
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
        assert data["version"] == 2
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
# AgentReportV2 schema
# ---------------------------------------------------------------------------


class TestAgentReportV2:
    def test_version_defaults_to_2(self) -> None:
        report = AgentReportV2(
            review_type="manual",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="test",
            duration_seconds=1.0,
        )
        assert report.version == 2

    def test_version_is_literal_2(self) -> None:
        """Cannot set version to anything other than 2."""
        with pytest.raises(ValidationError):
            AgentReportV2(
                version=1,  # type: ignore[arg-type]
                review_type="manual",
                report=_make_review_report(),
                data_snapshot=_make_data_snapshot(),
                model_used="test",
                duration_seconds=1.0,
            )

    def test_duration_defaults_to_zero(self) -> None:
        report = AgentReportV2(
            review_type="manual",
            report=_make_review_report(),
            data_snapshot=_make_data_snapshot(),
            model_used="test",
        )
        assert report.duration_seconds == 0.0

    def test_deny_verdict_with_high_risk(self) -> None:
        review_report = ReviewAgentReport(
            verdict=ReviewVerdict.DENY,
            summary="High risk organization",
            violated_sections=["section-1"],
            dimensions=[
                DimensionAssessment(
                    dimension=ReviewDimension.POLICY_COMPLIANCE,
                    risk_level=RiskLevel.HIGH,
                    confidence=0.9,
                    findings=["Policy violation"],
                    recommendation="Deny",
                ),
            ],
            overall_risk_level=RiskLevel.HIGH,
            recommended_action="Deny",
        )

        report = AgentReportV2(
            review_type="submission",
            report=review_report,
            data_snapshot=_make_data_snapshot(),
            model_used="gpt-4o",
            duration_seconds=5.0,
        )
        assert report.report.verdict == ReviewVerdict.DENY
        assert report.report.overall_risk_level == RiskLevel.HIGH
        assert report.report.overall_risk_score == 85.0  # HIGH = 85

    def test_overall_risk_score_computed_from_overall_risk_level(self) -> None:
        """overall_risk_score is derived from overall_risk_level, not dimensions."""
        review_report = ReviewAgentReport(
            verdict=ReviewVerdict.APPROVE,
            summary="Mixed risk",
            violated_sections=[],
            dimensions=[
                DimensionAssessment(
                    dimension=ReviewDimension.POLICY_COMPLIANCE,
                    risk_level=RiskLevel.LOW,
                    confidence=0.9,
                    findings=[],
                    recommendation="OK",
                ),
                DimensionAssessment(
                    dimension=ReviewDimension.PRODUCT_LEGITIMACY,
                    risk_level=RiskLevel.MEDIUM,
                    confidence=0.8,
                    findings=[],
                    recommendation="OK",
                ),
                DimensionAssessment(
                    dimension=ReviewDimension.IDENTITY_TRUST,
                    risk_level=RiskLevel.HIGH,
                    confidence=0.7,
                    findings=[],
                    recommendation="Check",
                ),
            ],
            overall_risk_level=RiskLevel.MEDIUM,
            recommended_action="Review",
        )
        # overall_risk_score is derived from overall_risk_level=MEDIUM, not dimensions
        assert review_report.overall_risk_score == RISK_LEVEL_SCORES[RiskLevel.MEDIUM]


# ---------------------------------------------------------------------------
# V1 → V2 migration
# ---------------------------------------------------------------------------


class TestV1ToV2Migration:
    def test_v1_parsed_returns_v2(self) -> None:
        """parse_agent_report on V1 data always returns AgentReportV2."""
        data = _make_v1_report_dict(version=1)
        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2

    def test_legacy_parsed_returns_v2(self) -> None:
        """Legacy data without version field returns AgentReportV2."""
        data = _make_v1_report_dict(version=None)
        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2

    def test_migration_preserves_all_fields(self) -> None:
        data = _make_v1_report_dict(version=1, review_type="threshold")
        parsed = parse_agent_report(data)

        assert parsed.review_type == "threshold"
        assert parsed.model_used == "gpt-4o-mini"
        assert parsed.duration_seconds == 2.5
        assert parsed.usage.input_tokens == 100
        assert parsed.report.verdict == ReviewVerdict.APPROVE

    def test_overall_risk_level_backfill_high_wins(self) -> None:
        """When V1 data has no overall_risk_level, HIGH dimension wins."""
        data = _make_v1_report_dict(version=1)
        data["report"]["dimensions"] = [
            {
                "dimension": "policy_compliance",
                "risk_level": "LOW",
                "confidence": 0.9,
                "findings": [],
                "recommendation": "OK",
            },
            {
                "dimension": "financial_risk",
                "risk_level": "HIGH",
                "confidence": 0.8,
                "findings": [],
                "recommendation": "Check",
            },
        ]
        data["report"].pop("overall_risk_level", None)
        data["report"].pop("overall_risk_score", None)

        parsed = parse_agent_report(data)
        assert parsed.report.overall_risk_level == RiskLevel.HIGH

    def test_overall_risk_level_backfill_medium_wins(self) -> None:
        """When V1 data has no overall_risk_level and max is MEDIUM."""
        data = _make_v1_report_dict(version=1)
        data["report"]["dimensions"] = [
            {
                "dimension": "policy_compliance",
                "risk_level": "LOW",
                "confidence": 0.9,
                "findings": [],
                "recommendation": "OK",
            },
            {
                "dimension": "financial_risk",
                "risk_level": "MEDIUM",
                "confidence": 0.8,
                "findings": [],
                "recommendation": "Check",
            },
        ]
        data["report"].pop("overall_risk_level", None)
        data["report"].pop("overall_risk_score", None)

        parsed = parse_agent_report(data)
        assert parsed.report.overall_risk_level == RiskLevel.MEDIUM

    def test_overall_risk_level_backfill_all_low(self) -> None:
        """When V1 data has no overall_risk_level and all dimensions are LOW."""
        data = _make_v1_report_dict(version=1)
        data["report"]["dimensions"] = [
            {
                "dimension": "policy_compliance",
                "risk_level": "LOW",
                "confidence": 0.9,
                "findings": [],
                "recommendation": "OK",
            },
        ]
        data["report"].pop("overall_risk_level", None)
        data["report"].pop("overall_risk_score", None)

        parsed = parse_agent_report(data)
        assert parsed.report.overall_risk_level == RiskLevel.LOW

    def test_overall_risk_level_backfill_no_dimensions(self) -> None:
        """When V1 data has no dimensions, defaults to MEDIUM."""
        data = _make_v1_report_dict(version=1)
        data["report"]["dimensions"] = []
        data["report"].pop("overall_risk_level", None)
        data["report"].pop("overall_risk_score", None)

        parsed = parse_agent_report(data)
        assert parsed.report.overall_risk_level == RiskLevel.MEDIUM


# ---------------------------------------------------------------------------
# Backward compatibility — ensures V1 data always parses successfully
# regardless of whether it uses old float scores or new risk levels.
# ---------------------------------------------------------------------------


def _make_old_style_v1_dict() -> dict[str, Any]:
    """Build a V1 report dict in the OLD format (float scores, no risk_level).

    Simulates data written before the RiskLevel migration.
    """
    return {
        "version": 1,
        "review_type": "manual",
        "report": {
            "verdict": "DENY",
            "summary": "High risk org",
            "merchant_summary": "Account under review",
            "violated_sections": [],
            "dimensions": [
                {
                    "dimension": "policy_compliance",
                    "score": 10.0,
                    "confidence": 0.78,
                    "findings": ["Product looks OK"],
                    "recommendation": "Approve",
                },
                {
                    "dimension": "product_legitimacy",
                    "score": 55.0,
                    "confidence": 0.62,
                    "findings": ["Some concerns"],
                    "recommendation": "Review",
                },
                {
                    "dimension": "identity_trust",
                    "score": 80.0,
                    "confidence": 0.7,
                    "findings": ["Suspicious signals"],
                    "recommendation": "Deny",
                },
            ],
            "overall_risk_score": 48.3,
            "recommended_action": "Deny pending investigation",
        },
        "data_snapshot": {
            "context": "manual",
            "organization": {"name": "Test Org", "slug": "test-org"},
            "products": {},
            "identity": {},
            "account": {},
            "metrics": {},
            "history": {},
            "collected_at": "2026-01-01T00:00:00Z",
        },
        "model_used": "gpt-4o",
        "duration_seconds": 5.0,
        "usage": {
            "input_tokens": 8000,
            "output_tokens": 1200,
            "total_tokens": 9200,
        },
        "timed_out": False,
        "error": None,
    }


def _make_new_style_v1_dict() -> dict[str, Any]:
    """Build a V1 report dict in the NEW format (risk_level enum, no float score).

    Simulates data written by the current code.
    """
    return {
        "version": 1,
        "review_type": "manual",
        "report": {
            "verdict": "DENY",
            "summary": "High risk org",
            "merchant_summary": "Account under review",
            "violated_sections": [],
            "dimensions": [
                {
                    "dimension": "policy_compliance",
                    "risk_level": "LOW",
                    "score": 15.0,
                    "confidence": 0.78,
                    "findings": ["Product looks OK"],
                    "recommendation": "Approve",
                },
                {
                    "dimension": "product_legitimacy",
                    "risk_level": "MEDIUM",
                    "score": 50.0,
                    "confidence": 0.62,
                    "findings": ["Some concerns"],
                    "recommendation": "Review",
                },
                {
                    "dimension": "identity_trust",
                    "risk_level": "HIGH",
                    "score": 85.0,
                    "confidence": 0.7,
                    "findings": ["Suspicious signals"],
                    "recommendation": "Deny",
                },
            ],
            "overall_risk_score": 50.0,
            "recommended_action": "Deny pending investigation",
        },
        "data_snapshot": {
            "context": "manual",
            "organization": {"name": "Test Org", "slug": "test-org"},
            "products": {},
            "identity": {},
            "account": {},
            "metrics": {},
            "history": {},
            "collected_at": "2026-01-01T00:00:00Z",
        },
        "model_used": "gpt-4o",
        "duration_seconds": 5.0,
        "usage": {
            "input_tokens": 8000,
            "output_tokens": 1200,
            "total_tokens": 9200,
        },
        "timed_out": False,
        "error": None,
    }


class TestV1BackwardCompatibility:
    """Ensure V1 data always parses successfully in all formats.

    All V1 data is now migrated to V2 on read.
    """

    def test_old_data_with_float_scores_parses(self) -> None:
        """Old V1 data with score: float and overall_risk_score parses OK."""
        data = _make_old_style_v1_dict()
        parsed = parse_agent_report(data)

        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2
        assert parsed.report.verdict == ReviewVerdict.DENY
        # Scores migrated to risk levels
        dims = parsed.report.dimensions
        assert dims[0].risk_level == RiskLevel.LOW  # score 10 → LOW
        assert dims[1].risk_level == RiskLevel.MEDIUM  # score 55 → MEDIUM
        assert dims[2].risk_level == RiskLevel.HIGH  # score 80 → HIGH
        # overall_risk_level backfilled: HIGH wins
        assert parsed.report.overall_risk_level == RiskLevel.HIGH

    def test_new_data_with_risk_levels_parses(self) -> None:
        """New V1 data with risk_level and computed score parses OK."""
        data = _make_new_style_v1_dict()
        parsed = parse_agent_report(data)

        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2
        dims = parsed.report.dimensions
        assert dims[0].risk_level == RiskLevel.LOW
        assert dims[1].risk_level == RiskLevel.MEDIUM
        assert dims[2].risk_level == RiskLevel.HIGH

    def test_new_data_with_risk_level_only_no_score_parses(self) -> None:
        """New data with risk_level but NO score field parses OK."""
        data = _make_new_style_v1_dict()
        for dim in data["report"]["dimensions"]:
            dim.pop("score", None)
        data["report"].pop("overall_risk_score", None)

        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        dims = parsed.report.dimensions
        assert dims[0].risk_level == RiskLevel.LOW
        assert dims[1].risk_level == RiskLevel.MEDIUM
        assert dims[2].risk_level == RiskLevel.HIGH

    def test_old_data_overall_risk_level_backfilled(self) -> None:
        """Old data without overall_risk_level gets it backfilled from dimensions."""
        data = _make_old_style_v1_dict()
        parsed = parse_agent_report(data)
        # Dimensions: LOW, MEDIUM, HIGH → overall_risk_level = HIGH (max wins)
        assert parsed.report.overall_risk_level == RiskLevel.HIGH
        assert parsed.report.overall_risk_score == RISK_LEVEL_SCORES[RiskLevel.HIGH]

    def test_serialized_data_includes_score_for_old_code(self) -> None:
        """model_dump includes both risk_level AND score for backward compat."""
        dim = DimensionAssessment(
            dimension=ReviewDimension.POLICY_COMPLIANCE,
            risk_level=RiskLevel.LOW,
            confidence=0.9,
            findings=[],
            recommendation="OK",
        )
        dumped = dim.model_dump(mode="json")
        assert "risk_level" in dumped
        assert "score" in dumped
        assert dumped["risk_level"] == "LOW"
        assert dumped["score"] == RISK_LEVEL_SCORES[RiskLevel.LOW]

    def test_serialized_report_includes_overall_risk_score(self) -> None:
        """model_dump includes overall_risk_score for backward compat."""
        report = _make_review_report()
        dumped = report.model_dump(mode="json")
        assert "overall_risk_score" in dumped
        assert dumped["overall_risk_score"] == RISK_LEVEL_SCORES[RiskLevel.LOW]
        assert "overall_risk_level" in dumped
        assert dumped["overall_risk_level"] == "LOW"

    def test_full_roundtrip_new_to_json_to_parsed(self) -> None:
        """Build → dump → parse roundtrip preserves all data."""
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="submission")
        data = report.model_dump(mode="json")

        # Ensure the serialized JSONB has the backward-compat keys
        assert data["version"] == 2
        assert "score" in data["report"]["dimensions"][0]
        assert "risk_level" in data["report"]["dimensions"][0]
        assert "overall_risk_score" in data["report"]
        assert "overall_risk_level" in data["report"]

        # Parse back
        restored = parse_agent_report(data)
        assert restored == report

    def test_full_roundtrip_old_to_json_to_parsed(self) -> None:
        """Old-format dict → parse → dump → parse roundtrip."""
        data = _make_old_style_v1_dict()
        parsed = parse_agent_report(data)
        dumped = parsed.model_dump(mode="json")
        reparsed = parse_agent_report(dumped)

        assert reparsed == parsed
        # And the dumped data has both score and risk_level
        for dim in dumped["report"]["dimensions"]:
            assert "score" in dim
            assert "risk_level" in dim

    def test_version_is_now_2(self) -> None:
        """build_agent_report always writes version=2."""
        result = _make_agent_review_result()
        report = build_agent_report(result, review_type="threshold")
        data = report.model_dump(mode="json")

        assert data["version"] == 2
        # And it round-trips
        parsed = parse_agent_report(data)
        assert parsed.version == 2

    def test_score_boundary_migration_values(self) -> None:
        """Verify boundary values for score → risk_level migration."""
        for score, expected_level in [
            (0.0, RiskLevel.LOW),
            (29.9, RiskLevel.LOW),
            (30.0, RiskLevel.MEDIUM),
            (69.9, RiskLevel.MEDIUM),
            (70.0, RiskLevel.HIGH),
            (100.0, RiskLevel.HIGH),
        ]:
            dim = DimensionAssessment.model_validate(
                {
                    "dimension": "policy_compliance",
                    "score": score,
                    "confidence": 0.5,
                    "findings": [],
                    "recommendation": "test",
                }
            )
            assert dim.risk_level == expected_level, (
                f"score={score} should map to {expected_level}, got {dim.risk_level}"
            )

    def test_dimension_score_derived_from_risk_level(self) -> None:
        """The computed score field matches RISK_LEVEL_SCORES."""
        for level in RiskLevel:
            dim = DimensionAssessment(
                dimension=ReviewDimension.POLICY_COMPLIANCE,
                risk_level=level,
                confidence=0.9,
                findings=[],
                recommendation="OK",
            )
            assert dim.score == RISK_LEVEL_SCORES[level]

    def test_production_error_data_parses(self) -> None:
        """Reproduce the exact data shape from the production error."""
        data = {
            "version": 1,
            "review_type": "manual",
            "report": {
                "verdict": "DENY",
                "summary": "Test summary",
                "merchant_summary": "",
                "violated_sections": [],
                "dimensions": [
                    {
                        "dimension": "policy_compliance",
                        "risk_level": "LOW",
                        "confidence": 0.78,
                        "findings": ["Product sold is legitimate"],
                        "recommendation": "No action needed",
                    },
                    {
                        "dimension": "product_legitimacy",
                        "risk_level": "MEDIUM",
                        "confidence": 0.62,
                        "findings": ["Stated business generally aligned"],
                        "recommendation": "Clarify pricing",
                    },
                    {
                        "dimension": "identity_trust",
                        "risk_level": "LOW",
                        "confidence": 0.7,
                        "findings": ["User identity verified"],
                        "recommendation": "Add webhook endpoint",
                    },
                    {
                        "dimension": "financial_risk",
                        "risk_level": "LOW",
                        "confidence": 0.66,
                        "findings": ["Limited payment history"],
                        "recommendation": "Continue monitoring",
                    },
                    {
                        "dimension": "prior_history",
                        "risk_level": "HIGH",
                        "confidence": 0.95,
                        "findings": ["User has denied organization"],
                        "recommendation": "Deny pending investigation",
                    },
                ],
                "overall_risk_score": 36.0,
                "recommended_action": "Deny due to prior denied org",
            },
            "data_snapshot": {
                "context": "manual",
                "organization": {"name": "Admin Org", "slug": "admin-org"},
                "products": {},
                "identity": {},
                "account": {},
                "metrics": {},
                "history": {},
                "collected_at": "2026-02-27T16:09:11.912334Z",
            },
            "model_used": "gpt-5.2-2025-12-11",
            "duration_seconds": 21.91,
            "timed_out": False,
            "error": None,
        }

        parsed = parse_agent_report(data)
        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2
        assert parsed.report.verdict == ReviewVerdict.DENY
        assert len(parsed.report.dimensions) == 5
        # overall_risk_level backfilled: HIGH wins (prior_history is HIGH)
        assert parsed.report.overall_risk_level == RiskLevel.HIGH
        assert parsed.report.overall_risk_score == RISK_LEVEL_SCORES[RiskLevel.HIGH]
