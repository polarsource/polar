"""Review section with agent report, account checklist and reply template."""

import contextlib
from collections.abc import Generator
from datetime import datetime
from typing import Any

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import card


class ReviewSection:
    """Render the review section with agent report, account checklist and reply template."""

    def __init__(
        self,
        organization: Organization,
        orders_count: int = 0,
        agent_report: dict[str, Any] | None = None,
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
    def agent_report_card(self) -> Generator[None]:
        """Render the agent review report card."""
        with card(bordered=True):
            if self.agent_report is None:
                with tag.h2(classes="text-lg font-bold mb-4"):
                    text("Agent Review Report")
                with tag.p(classes="text-sm text-base-content/60"):
                    text("No agent review yet")
                yield
                return

            report = self.agent_report.get("report", {})
            usage = self.agent_report.get("usage", {})

            # Header with timestamp
            with tag.div(classes="flex items-center justify-between mb-4"):
                with tag.h2(classes="text-lg font-bold"):
                    text("Agent Review Report")
                if self.agent_reviewed_at:
                    with tag.span(classes="text-xs text-base-content/60"):
                        text(self.agent_reviewed_at.strftime("%Y-%m-%d %H:%M UTC"))

            # Verdict badge + risk score
            with tag.div(classes="flex items-center gap-4 mb-4"):
                verdict = report.get("verdict", "")
                verdict_classes = {
                    "APPROVE": "badge-success",
                    "DENY": "badge-error",
                    "NEEDS_HUMAN_REVIEW": "badge-warning",
                }
                badge_class = verdict_classes.get(verdict, "badge-ghost")
                with tag.div(classes=f"badge {badge_class} badge-lg"):
                    text(verdict)

                risk_score = report.get("overall_risk_score")
                if risk_score is not None:
                    score_color = (
                        "text-success"
                        if risk_score < 30
                        else "text-warning" if risk_score < 70 else "text-error"
                    )
                    with tag.div(classes="flex items-center gap-1"):
                        with tag.span(classes="text-sm font-medium"):
                            text("Risk:")
                        with tag.span(classes=f"text-sm font-bold {score_color}"):
                            text(f"{risk_score:.0f}/100")

            # Summary
            summary = report.get("summary", "")
            if summary:
                with tag.p(classes="text-sm mb-4"):
                    text(summary)

            # Violated sections
            violated = report.get("violated_sections", [])
            if violated:
                with tag.div(classes="mb-4"):
                    with tag.span(classes="text-sm font-medium text-error"):
                        text("Violated sections: ")
                    with tag.span(classes="text-sm"):
                        text(", ".join(violated))

            # Per-dimension breakdown
            dimensions = report.get("dimensions", [])
            if dimensions:
                with tag.div(classes="mb-4"):
                    with tag.h3(classes="text-sm font-bold mb-2"):
                        text("Dimension Breakdown")
                    with tag.div(classes="space-y-3"):
                        for dim in dimensions:
                            self._render_dimension(dim)

            # Recommended action
            recommended = report.get("recommended_action", "")
            if recommended:
                with tag.div(
                    classes="p-3 bg-info/10 border border-info/30 rounded text-sm mb-4"
                ):
                    with tag.span(classes="font-medium"):
                        text("Recommended action: ")
                    text(recommended)

            # Usage info
            total_tokens = usage.get("total_tokens", 0)
            cost = usage.get("estimated_cost_usd")
            model_used = self.agent_report.get("model_used", "")
            duration = self.agent_report.get("duration_seconds")
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
                    if duration is not None:
                        with tag.span():
                            text(f"Duration: {duration:.1f}s")

            yield

    @staticmethod
    def _render_dimension(dim: dict[str, Any]) -> None:
        """Render a single dimension assessment."""
        name = dim.get("dimension", "").replace("_", " ").title()
        score = dim.get("score", 0)
        confidence = dim.get("confidence", 0)
        findings = dim.get("findings", [])
        recommendation = dim.get("recommendation", "")

        score_color = (
            "badge-success"
            if score < 30
            else "badge-warning" if score < 70 else "badge-error"
        )

        with tag.div(classes="border border-base-200 rounded p-3"):
            with tag.div(classes="flex items-center justify-between mb-1"):
                with tag.span(classes="text-sm font-medium"):
                    text(name)
                with tag.div(classes="flex items-center gap-2"):
                    with tag.div(classes=f"badge badge-sm {score_color}"):
                        text(f"{score:.0f}")
                    with tag.span(classes="text-xs text-base-content/60"):
                        text(f"{confidence:.0%} confidence")

            if findings:
                with tag.ul(classes="list-disc list-inside text-xs space-y-0.5 mt-1"):
                    for finding in findings:
                        with tag.li():
                            text(finding)

            if recommendation:
                with tag.p(classes="text-xs text-base-content/60 mt-1 italic"):
                    text(recommendation)

    @contextlib.contextmanager
    def checklist_card(self) -> Generator[None]:
        """Render the account review checklist card."""
        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Account Review Checklist")

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

            yield

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

        # Escape for JS
        escaped = (
            template_text.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
        )

        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Review Reply Template")

            with tag.pre(
                classes="text-sm bg-base-200 p-4 rounded whitespace-pre-wrap mb-4"
            ):
                text(template_text)

            with tag.button(
                classes="btn btn-sm btn-outline",
                onclick=f"navigator.clipboard.writeText(`{escaped}`); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy to Clipboard', 1000)",
            ):
                text("Copy to Clipboard")

            yield

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the complete review section."""
        with tag.div(classes="space-y-6"):
            with self.agent_report_card():
                pass

            with self.checklist_card():
                pass

            with self.reply_template_card():
                pass

            yield


__all__ = ["ReviewSection"]
