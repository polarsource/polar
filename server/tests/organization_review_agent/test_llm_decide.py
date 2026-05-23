"""Verify the LLM Decide path (pydantic-ai agent) end to end.

Injects a pydantic-ai TestModel as the decide model so the real agent
code path runs — prompt rendering, structured FinalReport output,
llm_call recording — without a live gateway key. Production swaps in
the configured gateway model; the fallback-to-heuristic path is
covered by the other graph tests (which run with no creds).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from pydantic_ai.models.test import TestModel

from polar.models.organization import Organization
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.organization_review_agent.agents import (
    build_decide_agent,
    render_decide_prompt,
)
from polar.organization_review_agent.graph import (
    DecideNode,
    GraphDeps,
    execute_graph,
)
from polar.organization_review_agent.schemas import (
    AgentVerdict,
    RaisedSignal,
    ReviewState,
    Severity,
    SignalKind,
)
from polar.postgres import AsyncSession


def _final_report_args(verdict: str) -> dict:
    return {
        "verdict": verdict,
        "summary": f"LLM decided {verdict} based on the signals.",
        "merchant_summary": (
            "" if verdict == "approve" else "We could not approve your account."
        ),
        "violated_sections": [],
        "decisive_signal_kinds": (
            ["user_blocked"] if verdict == "deny" else []
        ),
        "recommended_action": "Proceed per the verdict.",
    }


class TestBuildDecideAgent:
    def test_accepts_injected_model(self) -> None:
        """build_decide_agent passes a concrete Model straight through
        (this is the seam tests use; prod passes None → gateway)."""

        agent = build_decide_agent(
            TestModel(custom_output_args=_final_report_args("approve"))
        )
        assert agent is not None

    def test_render_prompt_includes_signals_and_memory(self) -> None:
        state = ReviewState(
            organization_id=__import__("uuid").UUID(int=7),
            context="submission",
            raised_signals=[
                RaisedSignal(
                    kind=SignalKind.HIGH_DISPUTE_RATE,
                    severity=Severity.HIGH,
                    summary="dispute rate 4%",
                )
            ],
        )
        prompt = render_decide_prompt(
            state,
            memory={"high_dispute_rate": {"approved": 2, "discarded": 0}},
        )
        assert "high_dispute_rate" in prompt
        assert "memory approved=2" in prompt
        assert "Raised signals" in prompt


@pytest.mark.asyncio
class TestLLMDecideThroughGraph:
    async def _run(
        self,
        session: AsyncSession,
        organization: Organization,
        verdict: str,
    ) -> OrganizationReviewAgentRun:
        run = OrganizationReviewAgentRun(
            organization_id=organization.id,
            context="submission",
            triggered_by="llm_decide_test",
            status=AgentRunStatus.RUNNING,
            org_snapshot={"slug": organization.slug, "status": "review"},
        )
        session.add(run)
        await session.flush()

        deps = GraphDeps(
            organization=organization,
            session=session,
            run=run,
            use_llm_decide=True,
            decide_model=TestModel(
                custom_output_args=_final_report_args(verdict)
            ),
        )
        # Drive only the Decide node directly with a minimal state so the
        # assertion targets the LLM path, not lane DB access.
        state = ReviewState(
            organization_id=organization.id, context="submission"
        )
        node = DecideNode()
        result = await node.run(state, deps)
        assert result is None  # terminal
        run.final_report = state.tentative_report.model_dump(mode="json")
        await session.flush()
        return run

    async def test_llm_verdict_drives_report(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._run(session, organization, "deny")
        assert run.final_report is not None
        assert run.final_report["verdict"] == AgentVerdict.DENY.value
        assert "LLM decided deny" in run.final_report["summary"]
        # The LLM call was recorded for the cost breakdown.
        assert len(run.llm_calls) == 1
        assert run.llm_calls[0]["agent"] == "decide"

    async def test_llm_approve_path(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._run(session, organization, "approve")
        assert run.final_report["verdict"] == AgentVerdict.APPROVE.value
        assert run.final_report["merchant_summary"] == ""

    async def test_full_graph_uses_llm_when_model_injected(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """execute_graph end to end with an injected model: the run
        completes APPROVE and records the decide llm_call."""

        run = OrganizationReviewAgentRun(
            organization_id=organization.id,
            context="submission",
            triggered_by="llm_decide_test",
            status=AgentRunStatus.RUNNING,
            org_snapshot={"slug": organization.slug, "status": "review"},
        )
        session.add(run)
        await session.flush()

        deps_model = TestModel(
            custom_output_args=_final_report_args("approve")
        )
        # execute_graph builds its own GraphDeps; patch the default so
        # the injected model flows through the real driver.
        with patch(
            "polar.organization_review_agent.graph.GraphDeps",
            lambda **kw: GraphDeps(
                **kw, use_llm_decide=True, decide_model=deps_model
            ),
        ):
            await execute_graph(session, run, organization)

        assert run.status == AgentRunStatus.COMPLETED
        assert run.final_report["verdict"] == AgentVerdict.APPROVE.value
        assert any(c["agent"] == "decide" for c in run.llm_calls)


@pytest.mark.asyncio
class TestHeuristicFallback:
    async def test_no_creds_falls_back_to_heuristic(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """With use_llm_decide=True but no injected model and no live
        gateway creds, _llm_decide returns None and the heuristic
        produces the verdict — the run still completes."""

        run = OrganizationReviewAgentRun(
            organization_id=organization.id,
            context="submission",
            triggered_by="llm_decide_test",
            status=AgentRunStatus.RUNNING,
            org_snapshot={"slug": organization.slug, "status": "review"},
        )
        session.add(run)
        await session.flush()

        deps = GraphDeps(
            organization=organization,
            session=session,
            run=run,
            use_llm_decide=True,
            decide_model=None,  # → gateway; no creds in test → fallback
        )
        state = ReviewState(
            organization_id=organization.id, context="submission"
        )
        node = DecideNode()
        await node.run(state, deps)
        # Heuristic produced a verdict (no signals → approve) and no
        # llm_call was recorded.
        assert state.tentative_report is not None
        assert state.tentative_report.verdict == AgentVerdict.APPROVE
        assert run.llm_calls == []
