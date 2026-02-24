"""Pydantic Evals dataset for the organization review agent.

Run with:
    uv run python -m evals.organization_review

Or via taskipy:
    uv run task eval
"""

from pydantic_evals import Case, Dataset

from polar.organization_review.schemas import (
    DataSnapshot,
    ReviewAgentReport,
    ReviewVerdict,
)

from .cases import (
    borderline_marketing_services,
    digital_templates_seller,
    high_financial_risk,
    legitimate_saas_setup_complete,
    legitimate_saas_submission,
    open_source_sponsorship,
    prior_denial_recreation,
    prohibited_adult_content,
    prohibited_gambling,
    prohibited_physical_goods,
)
from .evaluators import (
    AllDimensionsCovered,
    ExpectedReview,
    HasSummary,
    RiskScoreInRange,
    VerdictCorrect,
    ViolatedSectionsOnDeny,
)

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------


def build_dataset() -> Dataset[DataSnapshot, ReviewAgentReport, object]:
    """Construct the evaluation dataset with all cases and evaluators."""

    return Dataset[DataSnapshot, ReviewAgentReport, object](
        cases=[
            # --- Should APPROVE ---
            Case(
                name="legitimate_saas_submission",
                inputs=legitimate_saas_submission(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.APPROVE,
                    max_risk_score=40,
                ),
            ),
            Case(
                name="legitimate_saas_setup_complete",
                inputs=legitimate_saas_setup_complete(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.APPROVE,
                    max_risk_score=40,
                ),
            ),
            Case(
                name="open_source_sponsorship",
                inputs=open_source_sponsorship(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.APPROVE,
                    max_risk_score=40,
                ),
            ),
            Case(
                name="digital_templates_seller",
                inputs=digital_templates_seller(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.APPROVE,
                    max_risk_score=40,
                ),
            ),
            # --- Should DENY ---
            Case(
                name="prohibited_gambling",
                inputs=prohibited_gambling(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.DENY,
                    min_risk_score=60,
                ),
            ),
            Case(
                name="prohibited_physical_goods",
                inputs=prohibited_physical_goods(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.DENY,
                    min_risk_score=50,
                ),
            ),
            Case(
                name="prohibited_adult_content",
                inputs=prohibited_adult_content(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.DENY,
                    min_risk_score=60,
                ),
            ),
            Case(
                name="prior_denial_recreation",
                inputs=prior_denial_recreation(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    ReviewVerdict.DENY,
                    min_risk_score=60,
                ),
            ),
            # --- Should flag for human review (or deny) ---
            Case(
                name="high_financial_risk",
                inputs=high_financial_risk(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    [ReviewVerdict.NEEDS_HUMAN_REVIEW, ReviewVerdict.DENY],
                    min_risk_score=40,
                ),
            ),
            Case(
                name="borderline_marketing_services",
                inputs=borderline_marketing_services(),
                expected_output=ExpectedReview(  # type: ignore[arg-type]
                    [ReviewVerdict.NEEDS_HUMAN_REVIEW, ReviewVerdict.DENY],
                    min_risk_score=20,
                ),
            ),
        ],
        evaluators=[
            VerdictCorrect(),
            RiskScoreInRange(),
            AllDimensionsCovered(),
            HasSummary(),
            ViolatedSectionsOnDeny(),
        ],
    )
