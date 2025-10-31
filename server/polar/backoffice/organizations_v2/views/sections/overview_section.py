"""Overview section with review status cards."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import card, metric_card
from ....components._metric_card import Variant


class OverviewSection:
    """Render the overview section with review status cards."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def ai_review_card(self) -> Generator[None]:
        """Render AI review verdict card."""
        # Determine if risk is elevated
        has_elevated_risk = (
            self.org.review
            and self.org.review.risk_score is not None
            and self.org.review.risk_score >= 75
        )

        # Add bold border if risk is elevated
        border_class = "border-l-4 border-l-error" if has_elevated_risk else ""

        with card(bordered=True, classes=border_class):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("AI Review")

            if not self.org.review:
                with tag.p(classes="text-base-content/60"):
                    text("No review available yet.")
            else:
                review = self.org.review

                # Verdict badge
                with tag.div(classes="flex items-center gap-3 mb-3"):
                    with tag.span(
                        classes="badge badge-ghost border border-base-300 badge-lg"
                    ):
                        text(review.verdict or "N/A")

                    if review.risk_score is not None:
                        with tag.span(classes="text-lg font-bold"):
                            text(f"Risk: {review.risk_score}")

                # Violated sections
                if review.violated_sections:
                    with tag.div(classes="mb-3"):
                        with tag.div(classes="text-sm font-semibold mb-1"):
                            text("Violated Sections:")
                        with tag.div(classes="flex flex-wrap gap-1"):
                            for section in review.violated_sections:
                                with tag.span(
                                    classes="badge badge-ghost border border-base-300 badge-sm"
                                ):
                                    text(section)

                # Assessment reason
                if review.reason:
                    with tag.div(
                        classes="text-sm text-base-content/80 p-3 bg-base-200 rounded mt-3"
                    ):
                        text(review.reason)

                # Appeal information
                if review.appeal_submitted_at:
                    with tag.div(
                        classes="mt-4 p-3 border-l-4 border-base-300 bg-base-100 rounded"
                    ):
                        with tag.div(classes="font-semibold mb-1"):
                            text("Appeal Submitted")
                        if review.appeal_reason:
                            with tag.div(classes="text-sm text-base-content/70"):
                                text(review.appeal_reason)

                        if review.appeal_reviewed_at:
                            with tag.div(classes="mt-2 text-sm"):
                                with tag.span(classes="font-semibold"):
                                    text(f"Decision: {review.appeal_decision}")

            yield

    @contextlib.contextmanager
    def setup_card(
        self, setup_data: dict[str, int | bool] | None = None
    ) -> Generator[None]:
        """Render setup verdict card."""
        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Setup Status")

            if not setup_data:
                with tag.p(classes="text-base-content/60"):
                    text("Setup metrics not available.")
            else:
                # Metrics including payment ready
                with tag.div(classes="space-y-2"):
                    payment_ready = setup_data.get("payment_ready", False)

                    metrics = [
                        ("Payment Ready", "Yes" if payment_ready else "No"),
                        ("Checkout Links", setup_data.get("checkout_links_count", 0)),
                        ("Webhooks", setup_data.get("webhooks_count", 0)),
                        ("API Keys", setup_data.get("api_keys_count", 0)),
                        ("Products", setup_data.get("products_count", 0)),
                        ("Benefits", setup_data.get("benefits_count", 0)),
                    ]

                    for label, value in metrics:
                        with tag.div(
                            classes="flex items-center justify-between py-1.5 border-b border-base-200"
                        ):
                            with tag.span(classes="text-sm"):
                                text(label)
                            with tag.span(classes="font-mono text-sm font-semibold"):
                                text(str(value))

            yield

    @contextlib.contextmanager
    def payment_card(
        self, payment_stats: dict[str, int | float] | None = None
    ) -> Generator[None]:
        """Render payment statistics card."""
        # Check if payment risk is high
        p90_risk = payment_stats.get("p90_risk", 0) if payment_stats else 0
        has_high_risk = p90_risk >= 75
        border_class = "border-l-4 border-l-warning" if has_high_risk else ""

        with card(bordered=True, classes=border_class):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Payment Metrics")

            if not payment_stats:
                with tag.p(classes="text-base-content/60"):
                    text("No payment data available.")
            else:
                # Next review threshold and total transfers at top
                next_review_threshold = payment_stats.get("next_review_threshold")
                total_transfer_sum = payment_stats.get("total_transfer_sum")

                if next_review_threshold or total_transfer_sum:
                    with tag.div(
                        classes="space-y-2 mb-4 pb-4 border-b border-base-200"
                    ):
                        if next_review_threshold:
                            with tag.div(classes="flex items-center justify-between"):
                                with tag.span(classes="text-sm text-base-content/60"):
                                    text("Next Review")
                                with tag.span(
                                    classes="font-mono text-sm font-semibold"
                                ):
                                    text(f"${next_review_threshold / 100:,.0f}")

                        if total_transfer_sum:
                            with tag.div(classes="flex items-center justify-between"):
                                with tag.span(classes="text-sm text-base-content/60"):
                                    text("Total Transfers")
                                with tag.span(
                                    classes="font-mono text-sm font-semibold"
                                ):
                                    text(f"${total_transfer_sum / 100:,.2f}")

                # Payment metrics
                with tag.div(classes="grid grid-cols-2 gap-3 mb-3"):
                    with metric_card(
                        "Total Payments",
                        payment_stats.get("payment_count", 0),
                        compact=True,
                    ):
                        pass

                    with metric_card(
                        "Total Amount",
                        f"${payment_stats.get('total_amount', 0):,.2f}",
                        compact=True,
                    ):
                        pass

                # Risk scores
                risk_variant: Variant
                if p90_risk >= 75:
                    risk_variant = "error"
                elif p90_risk >= 50:
                    risk_variant = "warning"
                else:
                    risk_variant = "default"

                with tag.div(classes="grid grid-cols-2 gap-3 mb-3"):
                    with metric_card(
                        "P50 Risk",
                        payment_stats.get("p50_risk", 0),
                        variant="default",
                        compact=True,
                    ):
                        pass

                    with metric_card(
                        "P90 Risk",
                        payment_stats.get("p90_risk", 0),
                        variant=risk_variant,
                        compact=True,
                    ):
                        pass

                # Refund metrics
                refund_rate = payment_stats.get("refund_rate", 0)
                refund_variant: Variant = (
                    "error"
                    if refund_rate >= 15
                    else "warning"
                    if refund_rate >= 10
                    else "default"
                )

                with tag.div(classes="grid grid-cols-2 gap-3"):
                    with metric_card(
                        "Refunds",
                        payment_stats.get("refunds_count", 0),
                        subtitle=f"${payment_stats.get('refunds_amount', 0):,.2f}",
                        compact=True,
                    ):
                        pass

                    with metric_card(
                        "Refund Rate",
                        f"{refund_rate:.1f}%",
                        variant=refund_variant,
                        compact=True,
                    ):
                        pass

            yield

    @contextlib.contextmanager
    def render(
        self,
        request: Request,
        setup_data: dict[str, int | bool] | None = None,
        payment_stats: dict[str, int | float] | None = None,
    ) -> Generator[None]:
        """Render the complete overview section."""

        with tag.div(classes="space-y-6"):
            # Review status cards in a grid
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-3 gap-6"):
                with self.ai_review_card():
                    pass

                with self.setup_card(setup_data):
                    pass

                with self.payment_card(payment_stats):
                    pass

            yield


__all__ = ["OverviewSection"]
