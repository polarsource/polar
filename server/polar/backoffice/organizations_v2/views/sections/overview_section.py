"""Overview section with review, payment, setup/checklist and profile cards."""

import contextlib
import json
from collections.abc import Generator
from datetime import datetime
from typing import Any

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import card, metric_card
from ....components._metric_card import Variant


class OverviewSection:
    """Render the overview section as a 2x2 grid of cards."""

    def __init__(
        self,
        organization: Organization,
        orders_count: int = 0,
        unrefunded_orders_count: int = 0,
        agent_report: dict[str, Any] | None = None,
        agent_reviewed_at: datetime | None = None,
    ) -> None:
        self.org = organization
        self.orders_count = orders_count
        self.unrefunded_orders_count = unrefunded_orders_count
        self.agent_report = agent_report
        self.agent_reviewed_at = agent_reviewed_at

    # ------------------------------------------------------------------
    # Checklist helpers (ported from review_section.py)
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Top-left: Organization Review card
    # ------------------------------------------------------------------

    _REVIEW_CONTEXT_LABELS: dict[str, str] = {
        "submission": "Submission",
        "setup_complete": "Setup Complete",
        "threshold": "Threshold",
        "manual": "Manual",
    }

    def _render_review_context_badge(self, review_type: str | None) -> None:
        """Render a small badge showing the review trigger context."""
        if not review_type:
            return
        label = self._REVIEW_CONTEXT_LABELS.get(
            review_type, review_type.replace("_", " ").title()
        )
        with tag.div(classes="badge badge-ghost badge-sm badge-outline gap-1"):
            text(label)

    @contextlib.contextmanager
    def organization_review_card(self, request: Request) -> Generator[None]:
        """Merged agent report + org.review fallback card."""

        with card(bordered=True):
            # --- No agent report: show fallback from org.review ---
            if self.agent_report is None:
                # Fallback: show org.review data if available
                if self.org.review:
                    review = self.org.review

                    # Header with timestamp
                    with tag.div(classes="flex items-center justify-between mb-4"):
                        with tag.h2(classes="text-lg font-bold"):
                            text("Organization Review")
                        if review.validated_at:
                            with tag.span(classes="text-xs text-base-content/60"):
                                text(review.validated_at.strftime("%Y-%m-%d %H:%M UTC"))

                    # Verdict badge + risk score
                    with tag.div(classes="flex items-center gap-4 mb-4"):
                        verdict_str = (
                            review.verdict.value
                            if hasattr(review.verdict, "value")
                            else str(review.verdict or "N/A")
                        )
                        fallback_badge = (
                            "badge-error" if verdict_str == "FAIL" else "badge-neutral"
                        )
                        with tag.div(classes=f"badge {fallback_badge} badge-lg"):
                            text(verdict_str)

                        if review.risk_score is not None:
                            with tag.div(classes="flex items-center gap-1"):
                                with tag.span(classes="text-sm text-base-content/60"):
                                    text("Risk:")
                                with tag.span(classes="text-sm font-semibold"):
                                    text(f"{float(review.risk_score):.0f}/100")

                    # Assessment reason (as summary paragraph)
                    if review.reason:
                        with tag.p(classes="text-sm mb-4"):
                            text(review.reason)

                    # Violated sections (inline comma-separated)
                    if review.violated_sections:
                        with tag.div(classes="mb-4"):
                            with tag.span(
                                classes="text-sm font-medium text-base-content/70"
                            ):
                                text("Violated sections: ")
                            with tag.span(classes="text-sm"):
                                text(", ".join(review.violated_sections))

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

                    # Model info
                    if review.model_used:
                        with tag.div(
                            classes="flex flex-wrap gap-3 text-xs text-base-content/60 pt-3 border-t border-base-200"
                        ):
                            with tag.span():
                                text(f"Model: {review.model_used}")

                    # Organization details snapshot (collapsible)
                    if review.organization_details_snapshot:
                        with tag.details(classes="mt-4"):
                            with tag.summary(
                                classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
                            ):
                                text("View data snapshot used for this review")
                            with tag.pre(
                                classes="text-xs bg-base-200 p-4 rounded mt-2 overflow-x-auto max-h-96 overflow-y-auto"
                            ):
                                text(
                                    json.dumps(
                                        review.organization_details_snapshot,
                                        indent=2,
                                        default=str,
                                    )
                                )
                else:
                    with tag.div(classes="flex items-center justify-between mb-4"):
                        with tag.h2(classes="text-lg font-bold"):
                            text("Organization Review")
                    with tag.p(classes="text-sm text-base-content/60 mb-4"):
                        text("No agent review yet")

                yield
                return

            # --- Agent report present ---
            report = self.agent_report.get("report", {})
            usage = self.agent_report.get("usage", {})
            review_type = self.agent_report.get("review_type")

            # Header with timestamp
            with tag.div(classes="flex items-center justify-between mb-4"):
                with tag.div(classes="flex items-center gap-2"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Organization Review")
                    self._render_review_context_badge(review_type)
                if self.agent_reviewed_at:
                    with tag.span(classes="text-xs text-base-content/60"):
                        text(self.agent_reviewed_at.strftime("%Y-%m-%d %H:%M UTC"))

            # Verdict badge + risk score
            has_missing = bool(self.missing_items)
            with tag.div(classes="flex items-center gap-4 mb-4"):
                verdict = report.get("verdict", "")
                if verdict == "APPROVE" and has_missing:
                    badge_class = "badge-neutral"
                    display_verdict = "APPROVE (checklist incomplete)"
                elif verdict == "DENY":
                    badge_class = "badge-error"
                    display_verdict = verdict
                else:
                    badge_class = "badge-neutral"
                    display_verdict = verdict
                with tag.div(classes=f"badge {badge_class} badge-lg font-semibold"):
                    text(display_verdict)

                risk_score = report.get("overall_risk_score")
                if risk_score is not None:
                    with tag.div(classes="flex items-center gap-1"):
                        with tag.span(classes="text-sm text-base-content/60"):
                            text("AI Risk:")
                        with tag.span(classes="text-sm font-semibold"):
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
                    with tag.span(classes="text-sm font-medium text-base-content/70"):
                        text("Violated sections: ")
                    with tag.span(classes="text-sm"):
                        text(", ".join(violated))

            # Recommended action
            recommended = report.get("recommended_action", "")
            if recommended:
                with tag.div(
                    classes="p-3 bg-base-200 border border-base-300 rounded text-sm mb-4"
                ):
                    with tag.span(classes="font-medium"):
                        text("Recommended action: ")
                    text(recommended)

            # Per-dimension breakdown (collapsible)
            dimensions = report.get("dimensions", [])
            if dimensions:
                with tag.details(classes="mb-4"):
                    with tag.summary(
                        classes="text-sm font-bold cursor-pointer hover:text-base-content"
                    ):
                        text("Dimension Breakdown")
                    with tag.div(classes="space-y-3 mt-2"):
                        for dim in dimensions:
                            self._render_dimension(dim)

            # Appeal information
            if self.org.review and self.org.review.appeal_submitted_at:
                review = self.org.review
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

            # Data snapshot (collapsible)
            data_snapshot = self.agent_report.get("data_snapshot")
            if data_snapshot:
                with tag.details(classes="mt-4"):
                    with tag.summary(
                        classes="text-xs text-base-content/60 cursor-pointer hover:text-base-content"
                    ):
                        text("View data snapshot used for this review")
                    with tag.pre(
                        classes="text-xs bg-base-200 p-4 rounded mt-2 overflow-x-auto max-h-96 overflow-y-auto"
                    ):
                        text(json.dumps(data_snapshot, indent=2, default=str))

            yield

    # ------------------------------------------------------------------
    # Top-right: Payment Metrics card (unchanged)
    # ------------------------------------------------------------------

    @staticmethod
    def _rate_variant(
        value: float, *, yellow: float, red: float, higher_is_worse: bool = True
    ) -> Variant:
        """Pick metric card variant based on threshold direction."""
        if higher_is_worse:
            if value >= red:
                return "error"
            if value >= yellow:
                return "warning"
            return "default"
        # Lower-is-worse (e.g. auth rate)
        if value <= red:
            return "error"
        if value <= yellow:
            return "warning"
        return "default"

    @contextlib.contextmanager
    def payment_card(
        self, payment_stats: dict[str, int | float] | None = None
    ) -> Generator[None]:
        """Render payment statistics card with health-rate metrics."""

        # Determine worst variant for card-level border accent
        border_class = ""
        if payment_stats:
            variants = [
                self._rate_variant(
                    payment_stats.get("auth_rate", 100),
                    yellow=90,
                    red=75,
                    higher_is_worse=False,
                ),
                self._rate_variant(
                    payment_stats.get("refund_rate", 0), yellow=10, red=15
                ),
                self._rate_variant(
                    payment_stats.get("dispute_rate", 0), yellow=0.50, red=0.75
                ),
                self._rate_variant(
                    payment_stats.get("chargeback_rate", 0), yellow=0.15, red=0.30
                ),
            ]
            if "error" in variants:
                border_class = "border-l-4 border-l-error"
            elif "warning" in variants:
                border_class = "border-l-4 border-l-warning"

        with card(bordered=True, classes=border_class):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Payment Metrics")

            if not payment_stats:
                with tag.p(classes="text-base-content/60"):
                    text("No payment data available.")
            else:
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

                # Row 1: Total Payments + Total Amount
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

                # Row 2: Auth Rate + Refund Rate
                auth_rate = payment_stats.get("auth_rate", 100)
                refund_rate = payment_stats.get("refund_rate", 0)

                with tag.div(classes="grid grid-cols-2 gap-3 mb-3"):
                    with metric_card(
                        "Auth Rate",
                        f"{auth_rate:.1f}%",
                        subtitle=f"{payment_stats.get('failed_count', 0)} failed",
                        variant=self._rate_variant(
                            auth_rate, yellow=90, red=75, higher_is_worse=False
                        ),
                        compact=True,
                    ):
                        pass

                    with metric_card(
                        "Refund Rate",
                        f"{refund_rate:.1f}%",
                        subtitle=f"${payment_stats.get('refunds_amount', 0):,.2f}",
                        variant=self._rate_variant(refund_rate, yellow=10, red=15),
                        compact=True,
                    ):
                        pass

                # Row 3: Dispute Rate + Chargeback Rate
                dispute_rate = payment_stats.get("dispute_rate", 0)
                chargeback_rate = payment_stats.get("chargeback_rate", 0)

                with tag.div(classes="grid grid-cols-2 gap-3 mb-3"):
                    with metric_card(
                        "Dispute Rate",
                        f"{dispute_rate:.2f}%",
                        subtitle=f"{payment_stats.get('dispute_count', 0)} disputes (${payment_stats.get('dispute_amount', 0):,.2f})",
                        variant=self._rate_variant(dispute_rate, yellow=0.50, red=0.75),
                        compact=True,
                    ):
                        pass

                    with metric_card(
                        "Chargeback Rate",
                        f"{chargeback_rate:.2f}%",
                        subtitle=f"{payment_stats.get('chargeback_count', 0)} lost (${payment_stats.get('chargeback_amount', 0):,.2f})",
                        variant=self._rate_variant(
                            chargeback_rate, yellow=0.15, red=0.30
                        ),
                        compact=True,
                    ):
                        pass

                # Row 4: P50 + P90 Risk Scores
                risk_scores_count = payment_stats.get("risk_scores_count", 0)
                if risk_scores_count > 0:
                    p50_risk = payment_stats.get("p50_risk", 0)
                    p90_risk = payment_stats.get("p90_risk", 0)

                    with tag.div(classes="grid grid-cols-2 gap-3"):
                        with metric_card(
                            "P50 Risk Score",
                            f"{p50_risk:.0f}",
                            subtitle=f"median of {risk_scores_count} payments",
                            variant=self._rate_variant(p50_risk, yellow=50, red=65),
                            compact=True,
                        ):
                            pass

                        with metric_card(
                            "P90 Risk Score",
                            f"{p90_risk:.0f}",
                            subtitle="90th percentile",
                            variant=self._rate_variant(p90_risk, yellow=65, red=75),
                            compact=True,
                        ):
                            pass

            yield

    # ------------------------------------------------------------------
    # Bottom-left: Setup & Checklist card
    # ------------------------------------------------------------------

    @contextlib.contextmanager
    def setup_checklist_card(
        self, setup_data: dict[str, int | bool] | None = None
    ) -> Generator[None]:
        """Merged setup status + account checklist + reply template."""
        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Setup & Checklist")

            # --- Setup Status section ---
            if not setup_data:
                with tag.p(classes="text-base-content/60 mb-4"):
                    text("Setup metrics not available.")
            else:
                with tag.div(classes="space-y-2"):
                    payment_ready = setup_data.get("payment_ready", False)

                    metrics = [
                        ("Payment Ready", "Yes" if payment_ready else "No"),
                        ("Checkout Links", setup_data.get("checkout_links_count", 0)),
                        ("Webhooks", setup_data.get("webhooks_count", 0)),
                        ("API Keys", setup_data.get("api_keys_count", 0)),
                        ("Products", setup_data.get("products_count", 0)),
                        ("Benefits", setup_data.get("benefits_count", 0)),
                        (
                            "Enabled Benefits",
                            setup_data.get("enabled_benefits_count", 0),
                        ),
                    ]

                    for label, value in metrics:
                        with tag.div(
                            classes="flex items-center justify-between py-1.5 border-b border-base-200"
                        ):
                            with tag.span(classes="text-sm"):
                                text(label)
                            with tag.span(classes="font-mono text-sm font-semibold"):
                                text(str(value))

            # --- Checklist section ---
            self._render_checklist()

            yield

    # ------------------------------------------------------------------
    # Bottom-right: Organization Profile card
    # ------------------------------------------------------------------

    @contextlib.contextmanager
    def organization_profile_card(self) -> Generator[None]:
        """Read-only org profile: website, details, social links."""
        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Organization Profile")

            has_content = False

            # Website
            if self.org.website:
                has_content = True
                with tag.div(classes="mb-4"):
                    with tag.div(classes="text-sm font-semibold mb-2"):
                        text("Website")
                    with tag.div(classes="text-sm text-base-content/80"):
                        with tag.a(
                            href=str(self.org.website),
                            target="_blank",
                            rel="noopener noreferrer",
                            classes="link link-primary",
                        ):
                            text(str(self.org.website))

            # Details: about, product description, intended use
            if hasattr(self.org, "details") and self.org.details:
                details = self.org.details

                if details.get("about"):
                    has_content = True
                    with tag.div(classes="mb-4"):
                        with tag.div(classes="text-sm font-semibold mb-2"):
                            text("About")
                        with tag.div(
                            classes="text-sm text-base-content/80 whitespace-pre-wrap"
                        ):
                            text(details["about"])

                if details.get("product_description"):
                    has_content = True
                    with tag.div(classes="mb-4"):
                        with tag.div(classes="text-sm font-semibold mb-2"):
                            text("Product Description")
                        with tag.div(
                            classes="text-sm text-base-content/80 whitespace-pre-wrap"
                        ):
                            text(details["product_description"])

                if details.get("intended_use"):
                    has_content = True
                    with tag.div(classes="mb-4"):
                        with tag.div(classes="text-sm font-semibold mb-2"):
                            text("Intended Use")
                        with tag.div(
                            classes="text-sm text-base-content/80 whitespace-pre-wrap"
                        ):
                            text(details["intended_use"])

            # Social media links
            socials = self.org.socials or []
            if socials:
                has_content = True
                with tag.div(
                    classes="pt-4 mt-4 border-t border-base-200" if has_content else ""
                ):
                    with tag.div(classes="text-sm font-semibold mb-3"):
                        text("Social Media Links")
                    with tag.div(classes="space-y-2"):
                        for social in socials:
                            platform = social.get("platform", "").title()
                            url = social.get("url", "")
                            if platform and url:
                                with tag.div(
                                    classes="flex items-center justify-between py-1.5"
                                ):
                                    with tag.span(
                                        classes="text-sm font-medium capitalize"
                                    ):
                                        text(platform)
                                    with tag.a(
                                        href=url,
                                        target="_blank",
                                        rel="noopener noreferrer",
                                        classes="text-sm link link-primary truncate max-w-xs",
                                    ):
                                        text(url)

            if not has_content and not socials:
                with tag.p(classes="text-sm text-base-content/60"):
                    text("No profile information available.")

            yield

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _render_dimension(dim: dict[str, Any]) -> None:
        """Render a single dimension assessment."""
        name = dim.get("dimension", "").replace("_", " ").title()
        score = dim.get("score", 0)
        confidence = dim.get("confidence", 0)
        findings = dim.get("findings", [])
        recommendation = dim.get("recommendation", "")

        with tag.div(classes="border border-base-200 rounded p-3"):
            with tag.div(classes="flex items-center justify-between mb-1"):
                with tag.span(classes="text-sm font-medium"):
                    text(name)
                with tag.div(classes="flex items-center gap-2"):
                    with tag.div(classes="badge badge-sm badge-ghost"):
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

    def _render_checklist(self) -> None:
        """Render the account checklist rows."""
        with tag.div(classes="pt-4 mt-4 border-t border-base-200"):
            with tag.h3(classes="text-sm font-bold mb-3"):
                text("Account Checklist")

            with tag.div(classes="space-y-3"):
                self._checklist_row(
                    "Support Email",
                    self.has_email,
                    self.org.email if self.has_email else None,
                )

                self._checklist_row(
                    "Website URL",
                    self.has_website,
                    self.org.website if self.has_website else None,
                )

                if self.has_socials:
                    social_count = len(self.org.socials)
                    self._checklist_row(
                        "Social Media",
                        True,
                        f"{social_count} link{'s' if social_count != 1 else ''}",
                    )
                else:
                    self._checklist_row("Social Media", False, None)

                # Test Sales — dot color based on unrefunded orders
                # Green: no orders, or all refunded
                # Yellow: 1 unrefunded order
                # Red: multiple unrefunded orders
                if self.unrefunded_orders_count == 0:
                    dot_class = "bg-success"
                elif self.unrefunded_orders_count == 1:
                    dot_class = "bg-warning"
                else:
                    dot_class = "bg-error"

                with tag.div(
                    classes="flex items-center justify-between py-2 border-b border-base-200"
                ):
                    with tag.div(classes="flex items-center gap-2"):
                        with tag.span(
                            classes=f"w-2.5 h-2.5 rounded-full {dot_class} inline-block"
                        ):
                            pass
                        with tag.span(classes="text-sm font-medium"):
                            text("Test Sales")
                    with tag.span(classes="text-sm"):
                        text(
                            f"{self.orders_count} order{'s' if self.orders_count != 1 else ''}"
                        )

                if self.unrefunded_orders_count > 0:
                    with tag.div(
                        classes="mt-2 p-3 bg-warning/10 border border-warning/30 rounded text-sm"
                    ):
                        text(
                            f"{self.unrefunded_orders_count} unrefunded order{'s' if self.unrefunded_orders_count != 1 else ''} — should be auto-refunded before approval."
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

    # ------------------------------------------------------------------
    # Main render: 2x2 grid
    # ------------------------------------------------------------------

    @contextlib.contextmanager
    def render(
        self,
        request: Request,
        setup_data: dict[str, int | bool] | None = None,
        payment_stats: dict[str, int | float] | None = None,
    ) -> Generator[None]:
        """Render the complete overview section as a 2x2 grid."""

        with tag.div(classes="space-y-6"):
            # Top row: Organization Review + Payment Metrics
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-6"):
                with self.organization_review_card(request):
                    pass

                with self.payment_card(payment_stats):
                    pass

            # Bottom row: Setup & Checklist + Organization Profile
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-6"):
                with self.setup_checklist_card(setup_data):
                    pass

                with self.organization_profile_card():
                    pass

            yield


__all__ = ["OverviewSection"]
