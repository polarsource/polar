import contextlib
from collections.abc import Generator
from typing import Any

from tagflow import tag, text


class SetupVerdict:
    """Component for evaluating organization integration setup status."""

    def __init__(self, data: dict[str, Any], organization: Any = None) -> None:
        self.data = data
        self.organization = organization

    @property
    def verdict_text(self) -> str:
        """Get the verdict text based on setup score."""
        score = self.data.get("setup_score", 0)
        if score >= 5:
            return "COMPLETE"
        elif score >= 3:
            return "GOOD"
        elif score >= 1:
            return "PARTIAL"
        else:
            return "INCOMPLETE"

    def verdict_classes(self, verdict: str) -> str:
        """Get CSS classes for the verdict badge."""
        if verdict.upper() in ["COMPLETE", "GOOD"]:
            return "bg-green-100 text-green-800"
        elif verdict.upper() == "PARTIAL":
            return "bg-yellow-100 text-yellow-800"
        else:  # INCOMPLETE
            return "bg-red-100 text-red-800"

    @property
    def assessment_text(self) -> str:
        """Get assessment explanation text."""
        score = self.data.get("setup_score", 0)
        missing_items = []

        if not self.data.get("benefits_configured", False):
            missing_items.append("benefits configuration")
        if not self.data.get("webhooks_configured", False):
            missing_items.append("webhook endpoints")
        if not self.data.get("products_configured", False):
            missing_items.append("product configuration")
        if not self.data.get("api_keys_created", False):
            missing_items.append("API keys")
        if not self.data.get("user_verified", False):
            missing_items.append("user verification")

        if score >= 5:
            return "Organization has complete integration setup with all components properly configured."
        elif score >= 3:
            return "Organization has good integration setup with most components configured."
        elif score >= 1:
            missing_text = ", ".join(missing_items[:3])  # Show first 3 items
            if len(missing_items) > 3:
                missing_text += f" and {len(missing_items) - 3} more"
            return f"Organization has partial setup but is missing: {missing_text}."
        else:
            return "Organization has minimal integration setup. Most components need to be configured."

    @property
    def risk_level(self) -> str:
        """Get risk level based on setup score."""
        score = self.data.get("setup_score", 0)
        if score >= 5:
            return "green"  # Complete setup
        elif score >= 3:
            return "green"  # Good setup
        elif score >= 1:
            return "yellow"  # Partial setup
        else:
            return "red"  # Incomplete setup

    @contextlib.contextmanager
    def _render_detail_item(
        self, title: str, status: bool, count: int = 0, clickable: bool = False
    ) -> Generator[None]:
        """Render a detail item with status indicator."""
        classes = (
            "flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
        )
        if clickable:
            classes += " cursor-pointer"

        with tag.div(classes=classes):
            with tag.div(classes="flex items-center gap-2"):
                if status:
                    with tag.div(classes="w-2 h-2 rounded-full bg-green-500"):
                        pass
                else:
                    with tag.div(classes="w-2 h-2 rounded-full bg-red-500"):
                        pass
                with tag.span(classes="text-sm font-medium"):
                    text(title)
            if count > 0:
                with tag.span(classes="text-sm text-gray-600 font-medium"):
                    text(str(count))
        yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        """Render the setup verdict component."""
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title"):
                text("Setup")

            # Setup details
            with tag.div(classes="space-y-2 mt-4"):
                # Checkout links
                checkout_count = self.data.get("checkout_links_count", 0)
                with self._render_detail_item(
                    "Checkout Links", checkout_count > 0, checkout_count, clickable=True
                ):
                    pass

                # Webhooks
                webhooks_count = self.data.get("webhooks_count", 0)
                with self._render_detail_item(
                    "Webhook Endpoints",
                    webhooks_count > 0,
                    webhooks_count,
                    clickable=True,
                ):
                    pass

                # API Keys
                api_keys_count = self.data.get("api_keys_count", 0)
                with self._render_detail_item(
                    "API Keys", api_keys_count > 0, api_keys_count, clickable=True
                ):
                    pass

                # Products
                products_count = self.data.get("products_count", 0)
                with self._render_detail_item(
                    "Products", products_count > 0, products_count, clickable=True
                ):
                    pass

                # Benefits
                benefits_count = self.data.get("benefits_count", 0)
                with self._render_detail_item(
                    "Benefits", benefits_count > 0, benefits_count, clickable=True
                ):
                    pass

            # Verification section
            with tag.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with tag.div(classes="space-y-2"):
                    # User verification
                    user_verified = self.data.get("user_verified", False)
                    with self._render_detail_item(
                        "User Verified in Stripe", user_verified
                    ):
                        pass

                    # Account setup
                    account_enabled = self.data.get(
                        "account_charges_enabled", False
                    ) and self.data.get("account_payouts_enabled", False)
                    with self._render_detail_item(
                        "Account Charges & Payouts Enabled", account_enabled
                    ):
                        pass

        yield
