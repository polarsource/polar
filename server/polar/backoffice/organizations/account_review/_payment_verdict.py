import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text

from polar.backoffice.organizations.schemas import PaymentStatistics

from ...components import button
from ..forms import ApproveOrganizationForm, UnderReviewOrganizationForm


class PaymentVerdict:
    """Payment risk assessment component for 3-month period."""

    def __init__(
        self,
        payment_stats: PaymentStatistics,
        organization: Any = None,
        show_actions: bool = False,
        request: Any = None,
        validation_error: Any = None,
    ):
        self.payment_count = payment_stats.payment_count
        self.p50_risk = payment_stats.p50_risk
        self.p90_risk = payment_stats.p90_risk
        self.refunds_count = payment_stats.refunds_count
        self.transfer_sum = payment_stats.transfer_sum
        self.refunds_amount = payment_stats.refunds_amount
        self.total_payment_amount = payment_stats.total_payment_amount
        self.organization = organization
        self.show_actions = show_actions
        self.request = request
        self.validation_error = validation_error

    @property
    def refunds_ratio(self) -> float:
        """Calculate refund ratio."""
        if self.payment_count == 0:
            return 0
        return self.refunds_count / self.payment_count

    @property
    def refunds_amount_ratio(self) -> float:
        """Calculate refund amount ratio."""
        if self.total_payment_amount == 0:
            return 0
        return self.refunds_amount / self.total_payment_amount

    def _format_currency(self, amount: int) -> str:
        """Format amount as currency."""
        return f"${amount / 100:,.2f}"

    @contextlib.contextmanager
    def _render_metric_row(
        self, label: str, value: str, highlight: bool = False
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
                classes="text-sm font-semibold text-gray-900 dark:text-gray-100"
            ):
                text(value)
        yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the payment verdict component."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title"):
                text("Payments")

            # Payment metrics
            with tag.div(classes="space-y-2 mt-4"):
                with self._render_metric_row("Total Payments", str(self.payment_count)):
                    pass

                if self.payment_count > 0:
                    with self._render_metric_row(
                        "P50 Risk Score", f"{self.p50_risk:.1f}"
                    ):
                        pass

                    with self._render_metric_row(
                        "P90 Risk Score",
                        f"{self.p90_risk:.1f}",
                        highlight=(self.p90_risk >= 75),
                    ):
                        pass

                    with self._render_metric_row(
                        "Total Amount", self._format_currency(self.total_payment_amount)
                    ):
                        pass

            # Refunds section
            with tag.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with tag.div(classes="space-y-2"):
                    with self._render_metric_row(
                        "Refunds Count", str(self.refunds_count)
                    ):
                        pass

                    if self.refunds_count > 0:
                        with self._render_metric_row(
                            "Refund Rate",
                            f"{self.refunds_ratio:.1%}",
                            highlight=(self.refunds_ratio >= 0.15),
                        ):
                            pass

                        with self._render_metric_row(
                            "Refunds Amount", self._format_currency(self.refunds_amount)
                        ):
                            pass

                        with self._render_metric_row(
                            "Refund Amount Ratio", f"{self.refunds_amount_ratio:.1%}"
                        ):
                            pass

            # Balance section
            with tag.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with tag.div(classes="space-y-2"):
                    balance_color = (
                        "text-green-600" if self.transfer_sum >= 0 else "text-red-600"
                    )
                    with tag.div(
                        classes="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                    ):
                        with tag.div(classes="flex items-center gap-1"):
                            with tag.span(
                                classes="text-sm font-medium text-gray-700 dark:text-gray-300",
                                title="Sum of balance transactions - used for review threshold checking",
                            ):
                                text("Transfer Sum")
                            with tag.span(
                                classes="text-gray-400 dark:text-gray-500 cursor-help text-xs",
                                title="Sum of balance transactions - used for review threshold checking",
                            ):
                                text("ⓘ")
                        with tag.span(classes=f"text-sm font-bold {balance_color}"):
                            text(self._format_currency(self.transfer_sum))

                    # Next Review Threshold
                    if self.organization:
                        with self._render_metric_row(
                            "Next Review Threshold",
                            self._format_currency(
                                self.organization.next_review_threshold
                            ),
                        ):
                            pass

                        # Review Actions (context-sensitive based on organization status)
                        if self.show_actions and self.request:
                            with tag.div(classes="mt-3 pt-3 border-t border-gray-200"):
                                if self.organization.is_under_review:
                                    with tag.div(classes="text-center mb-3"):
                                        with tag.h4(
                                            classes="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
                                        ):
                                            text("Review Decision")
                                        with tag.p(
                                            classes="text-xs text-gray-600 dark:text-gray-400"
                                        ):
                                            text(
                                                "Based on the financial analysis above"
                                            )

                                    with ApproveOrganizationForm.render(
                                        data=None,
                                        method="POST",
                                        action=str(self.request.url),
                                        classes="space-y-4",
                                        validation_error=self.validation_error,
                                    ):
                                        with tag.div(
                                            classes="flex gap-2 justify-center mt-4"
                                        ):
                                            with button(
                                                name="action",
                                                type="submit",
                                                variant="primary",
                                                value="approve",
                                                size="sm",
                                            ):
                                                text("Approve")
                                            with button(
                                                name="action",
                                                type="submit",
                                                variant="error",
                                                value="deny",
                                                size="sm",
                                            ):
                                                text("Deny")
                                else:
                                    # Show "Set to Under Review" action when not under review
                                    with tag.div(classes="text-center mt-3 mb-3"):
                                        with tag.h4(
                                            classes="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
                                        ):
                                            text("Ready for Review?")
                                        with tag.p(
                                            classes="text-xs text-gray-600 dark:text-gray-400"
                                        ):
                                            text(
                                                "Based on financial threshold analysis"
                                            )

                                    with UnderReviewOrganizationForm.render(
                                        data=None,
                                        method="POST",
                                        action=str(self.request.url),
                                        classes="space-y-4",
                                        validation_error=self.validation_error,
                                    ):
                                        with tag.div(
                                            classes="flex justify-center mt-4"
                                        ):
                                            with button(
                                                name="action",
                                                type="submit",
                                                variant="primary",
                                                value="under_review",
                                                size="sm",
                                            ):
                                                text("Set to Under Review")

        yield
