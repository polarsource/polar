"""Tests for ``polar.organization_review_agent.schemas``.

Focus: serialisation round-trips (state must JSONB-cleanly) and
``RaisedSignal.kind`` enum enforcement (a typo dies at validation,
not silently in Decide).
"""

from __future__ import annotations

import json
from uuid import uuid4

import pytest
from pydantic import ValidationError

from polar.organization_review_agent.schemas import (
    AgentVerdict,
    FinalReport,
    LaneFacts,
    RaisedSignal,
    ReaderCues,
    ResolvedSignal,
    ReviewState,
    Severity,
    SignalKind,
    SignalResolution,
)


class TestRaisedSignal:
    def test_kind_must_be_registered_value(self) -> None:
        """Pydantic rejects strings that don't match a SignalKind value.

        This is the type-system enforcement the design plan promised:
        a lane that emits a typo dies at validation time, not silently
        downstream.
        """

        with pytest.raises(ValidationError):
            RaisedSignal.model_validate(
                {
                    "kind": "this_is_not_a_registered_signal",
                    "summary": "irrelevant",
                }
            )

    def test_kind_accepts_enum_member(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.HIGH_DISPUTE_RATE,
            summary="dispute rate 5% over last 90d (12/240)",
        )
        assert signal.kind == SignalKind.HIGH_DISPUTE_RATE

    def test_kind_accepts_snake_case_string(self) -> None:
        """Common pattern for round-tripping from JSONB.

        ReviewState lives in ``state_snapshot`` as JSON; on rehydrate
        the ``kind`` field arrives as a bare string and must coerce.
        """

        signal = RaisedSignal.model_validate(
            {"kind": "high_dispute_rate", "summary": "x"}
        )
        assert signal.kind == SignalKind.HIGH_DISPUTE_RATE

    def test_severity_optional(self) -> None:
        """``severity=None`` means 'use registry default at decide time'."""

        signal = RaisedSignal(
            kind=SignalKind.USER_BLOCKED, summary="user was blocked"
        )
        assert signal.severity is None


class TestResolvedSignal:
    def test_defaults_to_pending(self) -> None:
        resolved = ResolvedSignal(
            raised=RaisedSignal(kind=SignalKind.USER_BLOCKED, summary="x"),
        )
        assert resolved.resolution == SignalResolution.PENDING
        assert resolved.reviewer_reason is None
        assert resolved.reviewed_at is None


class TestReaderCues:
    def test_minimum_fields(self) -> None:
        cues = ReaderCues(source="website_page", summary="merchant sells X")
        assert cues.source == "website_page"
        assert cues.quoted_excerpts == []
        assert cues.addressed_signal_kinds == []


class TestReviewState:
    def test_json_roundtrip_is_lossless(self) -> None:
        """ReviewState must survive JSONB persistence + reload identity.

        ``state_snapshot`` is flushed on every node entry; any field
        that doesn't round-trip silently turns into a runtime crash on
        worker restart.
        """

        org_id = uuid4()
        state = ReviewState(
            organization_id=org_id,
            context="submission",
            triggered_by="shadow",
            lanes_enabled=["history", "identity"],
            findings={
                "history": LaneFacts(
                    name="history",
                    payload={"prior_denials": 2, "blocked_orgs": 0},
                )
            },
            raised_signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.HIGH,
                    summary="2 prior denials within 90d",
                    evidence={"days_back": 90, "count": 2},
                )
            ],
            resolved_signals=[],
            reader_cues=[
                ReaderCues(
                    source="appeal_reason",
                    summary="merchant says they fixed website",
                    addressed_signal_kinds=[
                        SignalKind.REDIRECT_TO_OTHER_DOMAIN
                    ],
                )
            ],
        )

        as_json = state.model_dump_json()
        reloaded = ReviewState.model_validate_json(as_json)

        assert reloaded == state
        # Also assert ``json.loads`` produces the expected shape on
        # disk, so the JSONB column matches future SQL filters.
        as_dict = json.loads(as_json)
        assert as_dict["organization_id"] == str(org_id)
        assert as_dict["raised_signals"][0]["kind"] == "prior_denials_present"

    def test_empty_state_is_valid(self) -> None:
        """A fresh state (Triage about to run) must validate.

        Triage emits the initial state with only ``organization_id`` +
        ``context`` set; everything else fills in across nodes.
        """

        state = ReviewState(
            organization_id=uuid4(), context="submission"
        )
        assert state.lanes_enabled == []
        assert state.findings == {}


class TestFinalReport:
    def test_merchant_summary_is_separate_field(self) -> None:
        """The merchant_summary / summary split is the v2 module's
        contract for what may safely surface on the merchant Case page.
        Pin it as a real field so refactors don't collapse them.
        """

        report = FinalReport(
            verdict=AgentVerdict.DENY,
            summary="High refund rate + prior denials suggest abuse pattern.",
            merchant_summary=(
                "We weren't able to approve your account at this time."
            ),
            recommended_action="Review with lead before activation.",
        )
        assert report.merchant_summary != report.summary
        assert "prior denials" not in report.merchant_summary
