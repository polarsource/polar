import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text


class AIReviewVerdict:
    """Component for displaying AI-generated organization review assessment."""

    def __init__(self, review: Any = None) -> None:
        self.review = review

    @property
    def verdict_text(self) -> str:
        """Get the verdict text."""
        if not self.review:
            return "NOT REVIEWED"
        # Handle both enum and string values
        return (
            self.review.verdict.value
            if hasattr(self.review.verdict, "value")
            else str(self.review.verdict)
        )

    @property
    def verdict_classes(self) -> str:
        """Get CSS classes for the verdict badge."""
        if not self.review:
            return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"

        # Handle both enum and string values
        verdict = (
            self.review.verdict.value
            if hasattr(self.review.verdict, "value")
            else str(self.review.verdict)
        )
        if verdict == "PASS":
            return (
                "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
            )
        elif verdict == "FAIL":
            return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
        else:  # UNCERTAIN
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"

    @property
    def risk_score_color(self) -> str:
        """Get color class for risk score based on value."""
        if not self.review:
            return "text-gray-600"

        score = self.review.risk_score
        if score < 0.3:
            return "text-green-600"
        elif score < 0.7:
            return "text-yellow-600"
        else:
            return "text-red-600"

    @contextlib.contextmanager
    def _render_metric_row(
        self, label: str, value: str, highlight: bool = False, color_class: str = ""
    ) -> Generator[None]:
        """Render a metric row."""
        row_classes = "flex items-center justify-between py-2 px-3 rounded-lg"
        if highlight:
            row_classes += " bg-blue-50 dark:bg-blue-900/20"
        else:
            row_classes += " hover:bg-gray-50 dark:hover:bg-gray-800"

        with tag.div(classes=row_classes):
            with tag.span(
                classes="text-sm font-medium text-gray-700 dark:text-gray-300"
            ):
                text(label)
            with tag.span(
                classes=f"text-sm font-semibold {color_class or 'text-gray-900 dark:text-gray-100'}"
            ):
                text(value)
        yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the AI review verdict component (compact version)."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title flex items-center gap-2"):
                text("AI Review")
                if self.review:
                    with tag.span(classes=f"badge text-xs {self.verdict_classes}"):
                        text(self.verdict_text)

            if not self.review:
                # No review available - compact version
                with tag.div(classes="text-center py-6"):
                    with tag.div(classes="text-gray-400 mb-2 text-2xl"):
                        text("🤖")
                    with tag.p(classes="text-gray-600 dark:text-gray-400 text-sm"):
                        text("AI review pending")
            else:
                # Review metrics - compact version
                with tag.div(classes="space-y-2 mt-4"):
                    with self._render_metric_row(
                        "Risk Score",
                        f"{self.review.risk_score:.2f}",
                        highlight=(self.review.risk_score >= 0.7),
                        color_class=self.risk_score_color,
                    ):
                        pass

                    if self.review.validated_at:
                        with self._render_metric_row(
                            "Reviewed",
                            self.review.validated_at.strftime("%m/%d/%y"),
                        ):
                            pass

                # Violated sections (if any) - full text, each on own line
                if self.review.violated_sections:
                    with tag.div(classes="mt-3 pt-3 border-t border-gray-200"):
                        with tag.div(classes="mb-2"):
                            with tag.span(
                                classes="text-sm font-medium text-gray-700 dark:text-gray-300"
                            ):
                                text("Violations")
                        with tag.div(classes="space-y-1"):
                            for section in self.review.violated_sections:
                                with tag.div(
                                    classes="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm px-2 py-1 rounded"
                                ):
                                    text(section)

                # Assessment reason - compact but readable
                if self.review.reason:
                    with tag.div(classes="mt-3 pt-3 border-t border-gray-200"):
                        with tag.div(classes="mb-2"):
                            with tag.span(
                                classes="text-sm font-medium text-gray-700 dark:text-gray-300"
                            ):
                                text("Assessment")
                        with tag.div(
                            classes="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded max-h-32 overflow-y-auto"
                        ):
                            # Split reason into paragraphs but keep compact
                            paragraphs = self.review.reason.split("\n\n")
                            for i, paragraph in enumerate(paragraphs):
                                if paragraph.strip():
                                    with tag.p(
                                        classes="mb-1"
                                        if i < len(paragraphs) - 1
                                        else ""
                                    ):
                                        text(paragraph.strip())

                # Timeout indicator - compact
                if self.review.timed_out:
                    with tag.div(classes="mt-3 pt-3 border-t border-gray-200"):
                        with tag.div(
                            classes="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-2"
                        ):
                            with tag.div(classes="flex items-center gap-1"):
                                with tag.span(classes="text-yellow-600 text-sm"):
                                    text("⚠️")
                                with tag.span(
                                    classes="text-yellow-800 dark:text-yellow-300 text-sm font-medium"
                                ):
                                    text("Timed Out")

        yield
