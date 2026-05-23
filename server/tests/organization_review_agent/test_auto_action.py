"""Tests for the outcome-anchored auto-action rule engine (Slice 6)."""

from __future__ import annotations

import pytest

from polar.organization_review_agent.auto_action import (
    REGISTRY,
    R1_CLEAN_APPROVE,
    AutoActionRule,
    RuleAction,
    RuleRolloutState,
    evaluate_retroactive,
)


class TestForbiddenActions:
    def test_enum_excludes_destructive_actions(self) -> None:
        """The RuleAction enum doesn't even define auto_deny /
        auto_block / auto_offboard / auto_deny_appeal — those
        decisions must always involve a human.
        """

        values = {action.value for action in RuleAction}
        forbidden = {
            "auto_deny",
            "auto_block",
            "auto_offboard",
            "auto_deny_appeal",
        }
        assert values.isdisjoint(forbidden)

    def test_action_constructor_rejects_forbidden_string(self) -> None:
        """Belt-and-suspenders: even if someone smuggles a forbidden
        value past the enum (e.g. by subclassing or string-coercion),
        the AutoActionRule constructor rejects it.
        """

        with pytest.raises(ValueError, match="permanently excluded"):

            class _FakeAction:
                value = "auto_deny"

            AutoActionRule(
                id="bad",
                description="x",
                predicate=lambda r: True,
                action=_FakeAction(),  # type: ignore[arg-type]
            )


class TestRulePromotionGate:
    def test_small_cohorts_block_promotion(self) -> None:
        """Even with perfect-matching predicates, sample-size floors
        prevent any rule from going live until enough historical data
        accumulates.
        """

        rule = AutoActionRule(
            id="R-test",
            description="always-true",
            predicate=lambda r: True,
            action=RuleAction.AUTO_CLOSE_APPROVE,
        )
        report = evaluate_retroactive(rule, runs=[], min_sample_size=25)
        assert report.promotion_eligible is False
        # Both cohorts empty → both reasons surface.
        assert any("matched" in r for r in report.reasons)
        assert any("control" in r for r in report.reasons)

    def test_rule_drafts_have_no_traffic(self) -> None:
        """Newly authored rules ship in DRAFT and don't see live runs."""

        for rule in REGISTRY.values():
            assert rule.rollout_state == RuleRolloutState.DRAFT


class TestR1Predicate:
    def test_fires_on_clean_approve(self) -> None:
        from polar.models.organization_review_agent_run import (
            OrganizationReviewAgentRun,
        )

        run = OrganizationReviewAgentRun(
            organization_id=__import__("uuid").UUID(int=1),
            context="submission",
            triggered_by="shadow",
            final_report={
                "verdict": "approve",
                "summary": "",
                "merchant_summary": "",
                "decisive_signal_kinds": [],
                "recommended_action": "",
            },
            org_snapshot={"status": "review"},
        )
        assert R1_CLEAN_APPROVE.predicate(run) is True

    def test_skips_when_decisive_signals_present(self) -> None:
        from polar.models.organization_review_agent_run import (
            OrganizationReviewAgentRun,
        )

        run = OrganizationReviewAgentRun(
            organization_id=__import__("uuid").UUID(int=1),
            context="submission",
            triggered_by="shadow",
            final_report={
                "verdict": "approve",
                "summary": "",
                "merchant_summary": "",
                "decisive_signal_kinds": ["high_dispute_rate"],
                "recommended_action": "",
            },
            org_snapshot={"status": "review"},
        )
        assert R1_CLEAN_APPROVE.predicate(run) is False

    def test_skips_deny_verdict(self) -> None:
        from polar.models.organization_review_agent_run import (
            OrganizationReviewAgentRun,
        )

        run = OrganizationReviewAgentRun(
            organization_id=__import__("uuid").UUID(int=1),
            context="submission",
            triggered_by="shadow",
            final_report={
                "verdict": "deny",
                "summary": "",
                "merchant_summary": "x",
                "decisive_signal_kinds": [],
                "recommended_action": "",
            },
            org_snapshot={"status": "review"},
        )
        assert R1_CLEAN_APPROVE.predicate(run) is False
