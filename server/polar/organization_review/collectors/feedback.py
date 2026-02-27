from polar.models.organization_review_feedback import OrganizationReviewFeedback

from ..schemas import PriorFeedbackData, PriorFeedbackEntry


def collect_feedback_data(
    records: list[OrganizationReviewFeedback],
) -> PriorFeedbackData:
    entries: list[PriorFeedbackEntry] = []
    for fb in records:
        agent_summary: str | None = None
        if fb.agent_review_id is not None:
            try:
                parsed = fb.agent_review.parsed_report
                agent_summary = parsed.report.summary
            except Exception:
                pass

        entries.append(
            PriorFeedbackEntry(
                actor_type=fb.actor_type or "unknown",
                decision=fb.decision or "unknown",
                review_context=fb.review_context or "unknown",
                verdict=fb.verdict,
                risk_score=fb.risk_score,
                reason=fb.reason,
                agent_summary=agent_summary,
                created_at=fb.created_at,
            )
        )

    return PriorFeedbackData(entries=entries)
