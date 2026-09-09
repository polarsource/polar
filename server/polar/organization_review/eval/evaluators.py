"""Custom evaluators for organization review evals."""

from dataclasses import dataclass

from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from .dataset import EvalInput, EvalMetadata


@dataclass
class VerdictMatch(Evaluator[EvalInput, str, EvalMetadata]):
    """Check if the predicted verdict matches the expected verdict."""

    def evaluate(self, ctx: EvaluatorContext[EvalInput, str, EvalMetadata]) -> bool:
        return ctx.output == ctx.expected_output
