import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text


class PaymentVerdict:
    """Payment risk assessment component."""

    def __init__(self, payment_stats: dict[str, Any]):
        self.payment_count = payment_stats["payment_count"]
        self.p50_risk = payment_stats["p50_risk"]
        self.p90_risk = payment_stats["p90_risk"]
        self.risk_level = payment_stats["risk_level"]

    @property
    def verdict_text(self) -> str:
        """Get the verdict text based on risk level."""
        if self.risk_level == "green":
            return "PASS"
        elif self.risk_level == "yellow":
            return "UNCERTAIN"
        else:  # red
            return "FAIL"

    @property
    def verdict_classes(self) -> str:
        """Get CSS classes for the verdict badge."""
        if self.risk_level == "green":
            return "bg-green-100 text-green-800"
        elif self.risk_level == "yellow":
            return "bg-yellow-100 text-yellow-800"
        else:  # red
            return "bg-red-100 text-red-800"

    @property
    def reason_text(self) -> str:
        """Get the reason text for the verdict."""
        return (
            f"P90 risk score ({self.p90_risk:.1f}) is {self._get_risk_threshold_text()}"
        )

    def _get_risk_threshold_text(self) -> str:
        """Get the risk threshold description."""
        if self.risk_level == "green":
            return "below 65"
        elif self.risk_level == "yellow":
            return "between 65-74"
        else:  # red
            return "75 or above"

    @property
    def assessment_text(self) -> str:
        """Get detailed risk assessment text."""
        if self.payment_count == 0:
            return "No payments with risk scores found in the last 30 days."
        elif self.risk_level == "green":
            return f"Low risk profile. 90% of payments have risk scores below {self.p90_risk:.1f}, indicating good payment quality."
        elif self.risk_level == "yellow":
            return f"Moderate risk profile. 90% of payments have risk scores below {self.p90_risk:.1f}, requiring monitoring."
        else:  # red
            return f"High risk profile. 90% of payments have risk scores below {self.p90_risk:.1f}, indicating potential fraud concerns."

    @contextlib.contextmanager
    def _render_indicator(self) -> Generator[None]:
        """Render the risk indicator with badge and reason."""
        with tag.div(classes="flex items-center gap-2"):
            with tag.div(
                classes=f"px-2 py-1 rounded text-xs font-medium {self.verdict_classes}"
            ):
                text(self.verdict_text)

            yield

    @contextlib.contextmanager
    def _render_detailed_stats(self) -> Generator[None]:
        """Render detailed payment statistics."""
        with tag.div(classes="space-y-2"):
            with tag.div(classes="flex justify-between"):
                with tag.span(classes="font-medium"):
                    text("Payment Count:")
                with tag.span():
                    text(str(self.payment_count))

            with tag.div(classes="flex justify-between"):
                with tag.span(classes="font-medium"):
                    text("P50 Risk Score:")
                with tag.span():
                    text(f"{self.p50_risk:.1f}")

            with tag.div(classes="flex justify-between"):
                with tag.span(classes="font-medium"):
                    text("P90 Risk Score:")
                with tag.span():
                    text(f"{self.p90_risk:.1f}")

            with tag.div(classes="mt-4 p-3 bg-gray-50 rounded-lg"):
                with tag.div(classes="text-sm font-medium mb-1"):
                    text("Risk Assessment:")
                with tag.div(classes="text-sm text-gray-700"):
                    text(self.assessment_text)

            with tag.div(classes="mt-4 text-xs text-gray-600"):
                text("Risk levels: Green (<65), Yellow (65-74), Red (≥75)")
            yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title"):
                text("Payments (Last 30 Days)")
                with self._render_indicator():
                    pass
            with self._render_detailed_stats():
                pass
        yield
