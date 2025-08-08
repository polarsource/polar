import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text


class PaymentVerdict:
    """Payment risk assessment component for 3-month period."""

    def __init__(self, payment_stats: dict[str, Any]):
        self.payment_count = payment_stats.get("payment_count", 0)
        self.p50_risk = payment_stats.get("p50_risk", 0)
        self.p90_risk = payment_stats.get("p90_risk", 0)
        self.risk_level = payment_stats.get("risk_level", "yellow")
        self.refunds_count = payment_stats.get("refunds_count", 0)
        self.total_balance = payment_stats.get("total_balance", 0)
        self.refunds_amount = payment_stats.get("refunds_amount", 0)
        self.total_payment_amount = payment_stats.get("total_payment_amount", 0)

    @property
    def verdict_text(self) -> str:
        """Get the verdict text based on risk level and metrics."""
        if self.payment_count == 0:
            return "NO DATA"
        elif self.risk_level == "green" and self.refunds_ratio < 0.05:
            return "LOW RISK"
        elif self.risk_level == "yellow" or self.refunds_ratio < 0.15:
            return "MEDIUM RISK"
        else:
            return "HIGH RISK"

    @property
    def verdict_classes(self) -> str:
        """Get CSS classes for the verdict badge."""
        verdict = self.verdict_text
        if verdict in ["LOW RISK"]:
            return "bg-green-100 text-green-800"
        elif verdict in ["MEDIUM RISK", "NO DATA"]:
            return "bg-yellow-100 text-yellow-800"
        else:
            return "bg-red-100 text-red-800"

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

    @property
    def assessment_text(self) -> str:
        """Get detailed payment assessment text."""
        if self.payment_count == 0:
            return "No payment data available for the last 3 months."
        
        risk_desc = "low" if self.risk_level == "green" else ("moderate" if self.risk_level == "yellow" else "high")
        refund_desc = "low" if self.refunds_ratio < 0.05 else ("moderate" if self.refunds_ratio < 0.15 else "high")
        
        return f"{risk_desc.title()} payment risk profile with {refund_desc} refund rate ({self.refunds_ratio:.1%}). Total processed: {self._format_currency(self.total_payment_amount)}, Balance: {self._format_currency(self.total_balance)}."

    @contextlib.contextmanager
    def _render_metric_row(self, label: str, value: str, highlight: bool = False) -> Generator[None]:
        """Render a metric row."""
        row_classes = "flex items-center justify-between py-2 px-3 rounded-lg"
        if highlight:
            row_classes += " bg-blue-50"
        else:
            row_classes += " hover:bg-gray-50"
            
        with tag.div(classes=row_classes):
            with tag.span(classes="text-sm font-medium text-gray-700"):
                text(label)
            with tag.span(classes="text-sm font-semibold text-gray-900"):
                text(value)
        yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the payment verdict component."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title flex items-center gap-2"):
                text("Payments (Last 3 Months)")
                # Risk indicator circle
                color = "green" if self.verdict_text == "LOW RISK" else ("yellow" if self.verdict_text in ["MEDIUM RISK", "NO DATA"] else "red")
                with tag.div(classes=f"w-3 h-3 rounded-full bg-{color}-500"):
                    pass
                # Verdict badge
                with tag.span(classes=f"px-2 py-1 text-xs font-medium rounded {self.verdict_classes}"):
                    text(self.verdict_text)

            # Payment metrics
            with tag.div(classes="space-y-2 mt-4"):
                with self._render_metric_row("Total Payments", str(self.payment_count)):
                    pass

                if self.payment_count > 0:
                    with self._render_metric_row("P50 Risk Score", f"{self.p50_risk:.1f}"):
                        pass

                    with self._render_metric_row("P90 Risk Score", f"{self.p90_risk:.1f}", highlight=(self.p90_risk >= 75)):
                        pass

                    with self._render_metric_row("Total Amount", self._format_currency(self.total_payment_amount)):
                        pass

            # Refunds section
            with tag.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with tag.div(classes="space-y-2"):
                    with self._render_metric_row("Refunds Count", str(self.refunds_count)):
                        pass

                    if self.refunds_count > 0:
                        with self._render_metric_row("Refund Rate", f"{self.refunds_ratio:.1%}", highlight=(self.refunds_ratio >= 0.15)):
                            pass

                        with self._render_metric_row("Refunds Amount", self._format_currency(self.refunds_amount)):
                            pass

                        with self._render_metric_row("Refund Amount Ratio", f"{self.refunds_amount_ratio:.1%}"):
                            pass

            # Balance section
            with tag.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with tag.div(classes="space-y-2"):
                    balance_color = "text-green-600" if self.total_balance >= 0 else "text-red-600"
                    with tag.div(classes="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"):
                        with tag.span(classes="text-sm font-medium text-gray-700"):
                            text("Total Balance")
                        with tag.span(classes=f"text-sm font-bold {balance_color}"):
                            text(self._format_currency(self.total_balance))

            # Assessment explanation
            with tag.div(classes="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded"):
                with tag.div(classes="text-sm font-medium mb-1"):
                    text("Payment Assessment:")
                with tag.p(classes="text-sm text-gray-700 dark:text-gray-300"):
                    text(self.assessment_text)

            # Risk level legend
            with tag.div(classes="mt-3 text-xs text-gray-600"):
                text("Risk levels: Green (<65), Yellow (65-74), Red (≥75) • Refund thresholds: Low (<5%), Medium (5-15%), High (≥15%)")

        yield
