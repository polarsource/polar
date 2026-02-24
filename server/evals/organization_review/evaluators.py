"""Custom pydantic-evals evaluators for organization review.

These evaluators validate the AI review agent's output against expected
verdicts, risk-score ranges, and structural requirements.
"""

from dataclasses import dataclass, field

from pydantic_evals.evaluators import EvaluationReason, Evaluator, EvaluatorContext

from polar.organization_review.schemas import (
    DataSnapshot,
    ReviewAgentReport,
    ReviewDimension,
    ReviewVerdict,
)


class ExpectedReview:
    """Lightweight expected-output type carried on each Case."""

    def __init__(
        self,
        verdict: ReviewVerdict | list[ReviewVerdict],
        *,
        min_risk_score: float = 0,
        max_risk_score: float = 100,
    ) -> None:
        self.verdicts = [verdict] if isinstance(verdict, ReviewVerdict) else verdict
        self.min_risk_score = min_risk_score
        self.max_risk_score = max_risk_score


# ---------------------------------------------------------------------------
# Evaluator: verdict matches one of the acceptable verdicts
# ---------------------------------------------------------------------------


@dataclass(repr=False)
class VerdictCorrect(Evaluator[DataSnapshot, ReviewAgentReport, object]):
    """Check the agent returned an acceptable verdict for this case."""

    async def evaluate(
        self, ctx: EvaluatorContext[DataSnapshot, ReviewAgentReport, object]
    ) -> EvaluationReason:
        expected: ExpectedReview | None = ctx.expected_output  # type: ignore[assignment]
        if expected is None:
            return EvaluationReason(value=True, reason="No expected verdict specified")

        actual = ctx.output.verdict
        ok = actual in expected.verdicts
        acceptable = ", ".join(v.value for v in expected.verdicts)
        return EvaluationReason(
            value=ok,
            reason=f"Verdict {actual.value} {'matches' if ok else 'does not match'} acceptable [{acceptable}]",
        )


# ---------------------------------------------------------------------------
# Evaluator: risk score falls in the expected range
# ---------------------------------------------------------------------------


@dataclass(repr=False)
class RiskScoreInRange(Evaluator[DataSnapshot, ReviewAgentReport, object]):
    """Check the overall risk score falls within the expected bounds."""

    async def evaluate(
        self, ctx: EvaluatorContext[DataSnapshot, ReviewAgentReport, object]
    ) -> EvaluationReason:
        expected: ExpectedReview | None = ctx.expected_output  # type: ignore[assignment]
        if expected is None:
            return EvaluationReason(value=True, reason="No risk score bounds specified")

        score = ctx.output.overall_risk_score
        ok = expected.min_risk_score <= score <= expected.max_risk_score
        return EvaluationReason(
            value=ok,
            reason=(
                f"Risk score {score:.1f} is {'within' if ok else 'outside'} "
                f"[{expected.min_risk_score}, {expected.max_risk_score}]"
            ),
        )


# ---------------------------------------------------------------------------
# Evaluator: all five review dimensions are present
# ---------------------------------------------------------------------------

_ALL_DIMENSIONS = {d for d in ReviewDimension}


@dataclass(repr=False)
class AllDimensionsCovered(Evaluator[DataSnapshot, ReviewAgentReport, object]):
    """Verify the report includes assessments for all review dimensions."""

    expected_dimensions: set[ReviewDimension] = field(default_factory=lambda: _ALL_DIMENSIONS)

    async def evaluate(
        self, ctx: EvaluatorContext[DataSnapshot, ReviewAgentReport, object]
    ) -> EvaluationReason:
        present = {d.dimension for d in ctx.output.dimensions}
        missing = self.expected_dimensions - present
        if missing:
            names = ", ".join(d.value for d in missing)
            return EvaluationReason(value=False, reason=f"Missing dimensions: {names}")
        return EvaluationReason(value=True, reason="All expected dimensions present")


# ---------------------------------------------------------------------------
# Evaluator: report has a non-empty summary
# ---------------------------------------------------------------------------


@dataclass(repr=False)
class HasSummary(Evaluator[DataSnapshot, ReviewAgentReport, object]):
    """Check that the report includes a meaningful summary."""

    min_length: int = 20

    async def evaluate(
        self, ctx: EvaluatorContext[DataSnapshot, ReviewAgentReport, object]
    ) -> EvaluationReason:
        summary = ctx.output.summary or ""
        ok = len(summary.strip()) >= self.min_length
        return EvaluationReason(
            value=ok,
            reason=f"Summary length {len(summary)} {'>=' if ok else '<'} {self.min_length}",
        )


# ---------------------------------------------------------------------------
# Evaluator: violated sections should be non-empty for DENY verdicts
# ---------------------------------------------------------------------------


@dataclass(repr=False)
class ViolatedSectionsOnDeny(Evaluator[DataSnapshot, ReviewAgentReport, object]):
    """When the verdict is DENY, expect at least one violated section."""

    async def evaluate(
        self, ctx: EvaluatorContext[DataSnapshot, ReviewAgentReport, object]
    ) -> EvaluationReason:
        if ctx.output.verdict != ReviewVerdict.DENY:
            return EvaluationReason(value=True, reason="Not a DENY verdict — skipped")
        has_sections = len(ctx.output.violated_sections) > 0
        return EvaluationReason(
            value=has_sections,
            reason=(
                "DENY verdict has violated sections"
                if has_sections
                else "DENY verdict is missing violated sections"
            ),
        )
