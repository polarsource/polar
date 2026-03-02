from polar.models.organization_review_feedback import OrganizationReviewFeedback

from ..schemas import (
    PriorDimensionAssessment,
    PriorFeedbackData,
    PriorFeedbackEntry,
)


def collect_feedback_data(
    records: list[OrganizationReviewFeedback],
) -> PriorFeedbackData:
    entries: list[PriorFeedbackEntry] = []
    for fb in records:
        agent_report_summary: str | None = None
        agent_risk_level: str | None = None
        violated_sections: list[str] = []
        dimensions: list[PriorDimensionAssessment] = []

        if fb.agent_review_id is not None:
            try:
                parsed = fb.agent_review.parsed_report
                report = parsed.report
                agent_report_summary = report.summary
                agent_risk_level = report.overall_risk_level.value
                violated_sections = list(report.violated_sections)
                dimensions = [
                    PriorDimensionAssessment(
                        dimension=dim.dimension.value,
                        risk_level=dim.risk_level.value,
                        findings=list(dim.findings),
                    )
                    for dim in report.dimensions
                ]
            except Exception:
                pass

        entries.append(
            PriorFeedbackEntry(
                actor_type=fb.actor_type or "unknown",
                decision=fb.decision or "unknown",
                review_context=fb.review_context or "unknown",
                reason=fb.reason,
                agent_verdict=fb.verdict,
                agent_risk_level=agent_risk_level,
                agent_report_summary=agent_report_summary,
                violated_sections=violated_sections,
                dimensions=dimensions,
                created_at=fb.created_at,
            )
        )

    return PriorFeedbackData(entries=entries)
