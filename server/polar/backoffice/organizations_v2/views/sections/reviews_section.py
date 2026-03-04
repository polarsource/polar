"""Reviews section showing agent reviews and associated feedback for an organization."""

import contextlib
import json
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization
from polar.models.organization_agent_review import OrganizationAgentReview

from ....components import card
from ._shared import RISK_LEVEL_BADGE, VERDICT_BADGE, render_dimension

# Badge classes for decision types
DECISION_BADGE: dict[str, str] = {
    "APPROVE": "badge-success",
    "DENY": "badge-error",
    "ESCALATE": "badge-warning",
}


class ReviewsSection:
    """Render the reviews section with agent reviews and their feedback."""

    def __init__(
        self,
        organization: Organization,
        agent_reviews: Sequence[OrganizationAgentReview],
    ) -> None:
        self.org = organization
        self.agent_reviews = agent_reviews

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the reviews section."""
        with tag.div(classes="space-y-6"):
            with card(bordered=True):
                with tag.div(classes="mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Review History")
                    with tag.span(classes="text-sm text-base-content/60"):
                        text(f"{len(self.agent_reviews)} review(s)")

                if not self.agent_reviews:
                    with tag.div(classes="text-center py-8 text-base-content/60"):
                        text("No reviews recorded yet")
                else:
                    with tag.div(classes="space-y-4"):
                        for review in self.agent_reviews:
                            self._render_review_card(review)

            yield

    def _render_review_card(self, review: OrganizationAgentReview) -> None:
        """Render a single agent review card with AI verdict and human decision."""
        parsed = review.parsed_report
        report = parsed.report

        # Split feedbacks into agent and human
        feedbacks = review.review_feedbacks
        human_feedback = next(
            (fb for fb in feedbacks if fb.actor_type == "human"), None
        )

        with tag.div(classes="border border-base-300 rounded-lg overflow-hidden"):
            # Header row: timestamp + model
            with tag.div(
                classes="flex items-center justify-between px-4 py-3 bg-base-200/50"
            ):
                with tag.div(classes="flex items-center gap-3"):
                    with tag.span(classes="text-sm font-medium"):
                        text(review.reviewed_at.strftime("%Y-%m-%d %H:%M UTC"))
                    with tag.span(classes="text-xs text-base-content/60"):
                        text(review.model_used)

            # AI Verdict + Human Decision side by side
            with tag.div(classes="px-4 py-3 border-b border-base-200"):
                with tag.div(classes="flex gap-6"):
                    # AI Verdict
                    with tag.div(classes="flex-1"):
                        with tag.div(
                            classes="text-xs font-bold uppercase tracking-wide text-base-content/60 mb-2"
                        ):
                            text("AI Verdict")
                        with tag.div(classes="flex items-center gap-2"):
                            verdict_val = report.verdict.value
                            badge_class = VERDICT_BADGE.get(verdict_val, "badge-ghost")
                            with tag.div(classes=f"badge {badge_class}"):
                                text(verdict_val)

                            risk_val = report.overall_risk_level.value
                            risk_badge = RISK_LEVEL_BADGE.get(risk_val, "badge-ghost")
                            with tag.div(classes=f"badge badge-sm {risk_badge}"):
                                text(f"Risk: {risk_val}")

                            if report.overall_risk_score is not None:
                                with tag.span(classes="text-xs text-base-content/60"):
                                    text(f"Score: {report.overall_risk_score:.2f}")

                    # Human Decision
                    with tag.div(classes="flex-1"):
                        with tag.div(
                            classes="text-xs font-bold uppercase tracking-wide text-base-content/60 mb-2"
                        ):
                            text("Human Decision")
                        if human_feedback:
                            with tag.div(classes="flex items-center gap-2"):
                                if human_feedback.decision:
                                    decision_badge = DECISION_BADGE.get(
                                        human_feedback.decision, "badge-ghost"
                                    )
                                    with tag.div(classes=f"badge {decision_badge}"):
                                        text(human_feedback.decision)

                                # Reviewer info
                                if human_feedback.reviewer_id is not None:
                                    try:
                                        if (
                                            human_feedback.reviewer
                                            and human_feedback.reviewer.email
                                        ):
                                            with tag.span(
                                                classes="text-xs text-base-content/60"
                                            ):
                                                text(human_feedback.reviewer.email)
                                    except Exception:
                                        pass

                                with tag.span(classes="text-xs text-base-content/40"):
                                    text(
                                        human_feedback.created_at.strftime(
                                            "%Y-%m-%d %H:%M"
                                        )
                                    )

                            # Reason
                            if human_feedback.reason:
                                with tag.p(classes="text-xs text-base-content/70 mt-1"):
                                    truncated = (
                                        human_feedback.reason[:120] + "..."
                                        if len(human_feedback.reason) > 120
                                        else human_feedback.reason
                                    )
                                    with tag.span(title=human_feedback.reason):
                                        text(truncated)
                        else:
                            with tag.span(classes="text-sm text-base-content/40"):
                                text("No human decision")

            # Summary
            if report.summary:
                with tag.div(classes="px-4 py-3 border-b border-base-200"):
                    with tag.p(classes="text-sm"):
                        text(report.summary)

            # Violated sections
            if report.violated_sections:
                with tag.div(classes="px-4 py-2 border-b border-base-200"):
                    with tag.span(classes="text-sm font-medium text-error"):
                        text("Violated: ")
                    with tag.span(classes="text-sm"):
                        text(", ".join(report.violated_sections))

            # Collapsible details: dimensions + data snapshot
            with tag.details(classes="group"):
                with tag.summary(
                    classes="px-4 py-2 text-xs text-base-content/60 cursor-pointer hover:text-base-content hover:bg-base-100"
                ):
                    text("View full report details")

                with tag.div(classes="px-4 py-3 bg-base-100"):
                    # Dimensions
                    if report.dimensions:
                        with tag.div(classes="mb-4"):
                            with tag.h4(classes="text-sm font-bold mb-2"):
                                text("Dimension Breakdown")
                            with tag.div(classes="space-y-2"):
                                for dim in report.dimensions:
                                    render_dimension(dim)

                    # Recommended action
                    if report.recommended_action:
                        with tag.div(
                            classes="p-3 bg-info/10 border border-info/30 rounded text-sm mb-4"
                        ):
                            with tag.span(classes="font-medium"):
                                text("Recommended action: ")
                            text(report.recommended_action)

                    # Data snapshot
                    with tag.details(classes="mt-3"):
                        with tag.summary(
                            classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
                        ):
                            text("View data snapshot")
                        snapshot_data = parsed.data_snapshot.model_dump(mode="json")
                        with tag.pre(
                            classes="text-xs bg-base-200 p-3 rounded mt-2 overflow-x-auto max-h-64 overflow-y-auto"
                        ):
                            text(json.dumps(snapshot_data, indent=2, default=str))


__all__ = ["ReviewsSection"]
