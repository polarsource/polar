"""Review section with agent report, account checklist and reply template."""

import contextlib
import json
from collections.abc import Generator
from datetime import datetime

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization
from polar.organization_review.report import AnyAgentReport
from polar.organization_review.schemas import DimensionAssessment

from ....components import button, card


class ReviewSection:
    """Render the review section with agent report, account checklist and reply template."""

    def __init__(
        self,
        organization: Organization,
        orders_count: int = 0,
        agent_report: AnyAgentReport | None = None,
        agent_reviewed_at: datetime | None = None,
    ) -> None:
        self.org = organization
        self.orders_count = orders_count
        self.agent_report = agent_report
        self.agent_reviewed_at = agent_reviewed_at

    @property
    def has_email(self) -> bool:
        return bool(self.org.email)

    @property
    def has_website(self) -> bool:
        return bool(self.org.website)

    @property
    def has_socials(self) -> bool:
        return bool(self.org.socials and len(self.org.socials) >= 1)

    @property
    def missing_items(self) -> list[str]:
        items = []
        if not self.has_email:
            items.append("Add a support email in your organization settings")
        if not self.has_website:
            items.append("Add your website URL in your organization settings")
        if not self.has_socials:
            items.append(
                "Add at least one social media link in your organization settings"
            )
        return items

    @contextlib.contextmanager
    def agent_report_card(self, request: Request) -> Generator[None]:
        """Render the combined agent review report and account checklist card."""
        run_agent_url = str(
            request.url_for(
                "organizations:run_review_agent",
                organization_id=self.org.id,
            )
        )

        with card(bordered=True):
            if self.agent_report is None:
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Organization Review")
                    with button(
                        variant="primary",
                        size="sm",
                        outline=True,
                        hx_post=run_agent_url,
                        hx_confirm="Run organization review agent?",
                    ):
                        text("Run Agent")
                with tag.p(classes="text-sm text-base-content/60 mb-4"):
                    text("No agent review yet")

                # Account checklist (always shown)
                self._render_checklist()

                yield
                return

            ar = self.agent_report
            review_report = ar.report
            usage = ar.usage

            # Header with timestamp and re-run button
            with tag.div(classes="flex items-center justify-between mb-4"):
                with tag.h2(classes="text-lg font-bold"):
                    text("Organization Review")
                with tag.div(classes="flex items-center gap-3"):
                    if self.agent_reviewed_at:
                        with tag.span(classes="text-xs text-base-content/60"):
                            text(self.agent_reviewed_at.strftime("%Y-%m-%d %H:%M UTC"))
                    with button(
                        variant="secondary",
                        size="sm",
                        outline=True,
                        hx_post=run_agent_url,
                        hx_confirm="Re-run organization review agent?",
                    ):
                        text("Re-run Agent")

            # Verdict badge + risk score
            has_missing = bool(self.missing_items)
            with tag.div(classes="flex items-center gap-4 mb-4"):
                verdict = review_report.verdict.value
                verdict_classes = {
                    "APPROVE": "badge-success",
                    "DENY": "badge-error",
                    "NEEDS_HUMAN_REVIEW": "badge-warning",
                }
                # Override APPROVE to warning when checklist items are missing
                if verdict == "APPROVE" and has_missing:
                    badge_class = "badge-warning"
                    display_verdict = "APPROVE (checklist incomplete)"
                else:
                    badge_class = verdict_classes.get(verdict, "badge-ghost")
                    display_verdict = verdict
                with tag.div(classes=f"badge {badge_class} badge-lg"):
                    text(display_verdict)

                risk_score = review_report.overall_risk_score
                score_color = (
                    "text-success"
                    if risk_score < 30
                    else "text-warning"
                    if risk_score < 70
                    else "text-error"
                )
                with tag.div(classes="flex items-center gap-1"):
                    with tag.span(classes="text-sm font-medium"):
                        text("AI Risk:")
                    with tag.span(classes=f"text-sm font-bold {score_color}"):
                        text(f"{risk_score:.0f}/100")

            # Summary
            if review_report.summary:
                with tag.p(classes="text-sm mb-4"):
                    text(review_report.summary)

            # Violated sections
            if review_report.violated_sections:
                with tag.div(classes="mb-4"):
                    with tag.span(classes="text-sm font-medium text-error"):
                        text("Violated sections: ")
                    with tag.span(classes="text-sm"):
                        text(", ".join(review_report.violated_sections))

            # Per-dimension breakdown
            if review_report.dimensions:
                with tag.div(classes="mb-4"):
                    with tag.h3(classes="text-sm font-bold mb-2"):
                        text("Dimension Breakdown")
                    with tag.div(classes="space-y-3"):
                        for dim in review_report.dimensions:
                            self._render_dimension(dim)

            # Recommended action
            if review_report.recommended_action:
                with tag.div(
                    classes="p-3 bg-info/10 border border-info/30 rounded text-sm mb-4"
                ):
                    with tag.span(classes="font-medium"):
                        text("Recommended action: ")
                    text(review_report.recommended_action)

            # Account checklist (always shown)
            self._render_checklist()

            # Usage info
            total_tokens = usage.total_tokens
            cost = usage.estimated_cost_usd
            model_used = ar.model_used
            duration = ar.duration_seconds
            if total_tokens or cost or model_used:
                with tag.div(
                    classes="flex flex-wrap gap-3 text-xs text-base-content/60 pt-3 border-t border-base-200"
                ):
                    if model_used:
                        with tag.span():
                            text(f"Model: {model_used}")
                    if total_tokens:
                        with tag.span():
                            text(f"Tokens: {total_tokens:,}")
                    if cost is not None:
                        with tag.span():
                            text(f"Cost: ${cost:.4f}")
                    if duration:
                        with tag.span():
                            text(f"Duration: {duration:.1f}s")

            # Data snapshot (collapsible)
            snapshot_data = ar.data_snapshot.model_dump(mode="json")
            with tag.details(classes="mt-4"):
                with tag.summary(
                    classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
                ):
                    text("View data snapshot used for this review")
                with tag.pre(
                    classes="text-xs bg-base-200 p-4 rounded mt-2 overflow-x-auto max-h-96 overflow-y-auto"
                ):
                    text(json.dumps(snapshot_data, indent=2, default=str))

            yield

    @staticmethod
    def _render_dimension(dim: DimensionAssessment) -> None:
        """Render a single dimension assessment."""
        name = dim.dimension.value.replace("_", " ").title()

        score_color = (
            "badge-success"
            if dim.score < 30
            else "badge-warning"
            if dim.score < 70
            else "badge-error"
        )

        with tag.div(classes="border border-base-200 rounded p-3"):
            with tag.div(classes="flex items-center justify-between mb-1"):
                with tag.span(classes="text-sm font-medium"):
                    text(name)
                with tag.div(classes="flex items-center gap-2"):
                    with tag.div(classes=f"badge badge-sm {score_color}"):
                        text(f"{dim.score:.0f}")
                    with tag.span(classes="text-xs text-base-content/60"):
                        text(f"{dim.confidence:.0%} confidence")

            if dim.findings:
                with tag.ul(classes="list-disc list-inside text-xs space-y-0.5 mt-1"):
                    for finding in dim.findings:
                        with tag.li():
                            text(finding)

            if dim.recommendation:
                with tag.p(classes="text-xs text-base-content/60 mt-1 italic"):
                    text(dim.recommendation)

    def _render_checklist(self) -> None:
        """Render the account checklist inline within the report card."""
        with tag.div(classes="pt-4 mt-4 border-t border-base-200"):
            with tag.h3(classes="text-sm font-bold mb-3"):
                text("Account Checklist")

            with tag.div(classes="space-y-3"):
                # Support Email
                self._checklist_row(
                    "Support Email",
                    self.has_email,
                    self.org.email if self.has_email else None,
                )

                # Website URL
                self._checklist_row(
                    "Website URL",
                    self.has_website,
                    self.org.website if self.has_website else None,
                )

                # Social Media
                if self.has_socials:
                    social_count = len(self.org.socials)
                    self._checklist_row(
                        "Social Media",
                        True,
                        f"{social_count} link{'s' if social_count != 1 else ''}",
                    )
                else:
                    self._checklist_row("Social Media", False, None)

                # Test Sales (info row, not pass/fail)
                with tag.div(
                    classes="flex items-center justify-between py-2 border-b border-base-200"
                ):
                    with tag.div(classes="flex items-center gap-2"):
                        with tag.span(
                            classes="w-2.5 h-2.5 rounded-full bg-info inline-block"
                        ):
                            pass
                        with tag.span(classes="text-sm font-medium"):
                            text("Test Sales")
                    with tag.span(classes="text-sm"):
                        text(
                            f"{self.orders_count} order{'s' if self.orders_count != 1 else ''}"
                        )

                if self.orders_count > 0:
                    with tag.div(
                        classes="mt-2 p-3 bg-warning/10 border border-warning/30 rounded text-sm"
                    ):
                        text(
                            "This organization has orders that should be auto-refunded before approval."
                        )

    @staticmethod
    def _checklist_row(label: str, is_set: bool, value: str | None) -> None:
        """Render a single checklist row."""
        with tag.div(
            classes="flex items-center justify-between py-2 border-b border-base-200"
        ):
            with tag.div(classes="flex items-center gap-2"):
                dot_class = "bg-success" if is_set else "bg-error"
                with tag.span(
                    classes=f"w-2.5 h-2.5 rounded-full {dot_class} inline-block"
                ):
                    pass
                with tag.span(classes="text-sm font-medium"):
                    text(label)
            with tag.span(
                classes="text-sm" + (" text-base-content/60" if not is_set else "")
            ):
                text((value or "Set") if is_set else "Missing")

    @contextlib.contextmanager
    def reply_template_card(self) -> Generator[None]:
        """Render the reply template card (only when items are missing)."""
        missing = self.missing_items
        if not missing:
            yield
            return

        template_lines = [
            "Hi,",
            "",
            "Thank you for setting up your account on Polar. Before we can approve your account, we need you to complete the following:",
            "",
        ]
        for item in missing:
            template_lines.append(f"- [ ] {item}")
        template_lines.extend(
            [
                "",
                "We'd also recommend creating a 100% discount code to test your checkout flow before going live.",
                "",
                "Best regards,",
                "Polar Team",
            ]
        )
        template_text = "\n".join(template_lines)

        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Review Reply Template")

            with tag.pre(
                classes="text-sm bg-base-200 p-4 rounded whitespace-pre-wrap mb-4"
            ):
                text(template_text)

            with tag.button(
                classes="btn btn-sm btn-outline",
                **{"data-copy-text": template_text},
                _="on click call navigator.clipboard.writeText(my.dataset.copyText) then put 'Copied!' into me then wait 1s then put 'Copy to Clipboard' into me",
            ):
                text("Copy to Clipboard")

            yield

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the complete review section."""
        with tag.div(classes="space-y-6"):
            with self.agent_report_card(request):
                pass

            with self.reply_template_card():
                pass

            yield


__all__ = ["ReviewSection"]
