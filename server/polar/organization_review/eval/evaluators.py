"""Custom evaluators for organization review evals."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from .dataset import FeedbackReviewInput, FeedbackReviewMetadata


@dataclass
class VerdictMatch(Evaluator[FeedbackReviewInput, str, FeedbackReviewMetadata]):
    """Check if the predicted verdict matches the expected verdict."""

    def evaluate(
        self, ctx: EvaluatorContext[FeedbackReviewInput, str, FeedbackReviewMetadata]
    ) -> bool:
        return ctx.output == ctx.expected_output


@dataclass
class NotFalseNegative(Evaluator[FeedbackReviewInput, str, FeedbackReviewMetadata]):
    """Check we don't approve orgs that should be denied/uncertain.

    A false negative (PASS when ground truth is FAIL/UNCERTAIN) is the
    most dangerous error — it lets a risky org through.
    """

    def evaluate(
        self, ctx: EvaluatorContext[FeedbackReviewInput, str, FeedbackReviewMetadata]
    ) -> bool:
        if ctx.expected_output in ("FAIL", "UNCERTAIN"):
            return ctx.output != "PASS"
        return True


@dataclass
class NotFalsePositive(Evaluator[FeedbackReviewInput, str, FeedbackReviewMetadata]):
    """Check we don't deny orgs that should be approved.

    A false positive (FAIL when ground truth is PASS) harms legitimate
    sellers but is less risky than a false negative.
    """

    def evaluate(
        self, ctx: EvaluatorContext[FeedbackReviewInput, str, FeedbackReviewMetadata]
    ) -> bool:
        if ctx.expected_output == "PASS":
            return ctx.output != "FAIL"
        return True
