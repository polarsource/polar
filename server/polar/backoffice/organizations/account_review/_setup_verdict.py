import contextlib
import urllib.parse
from collections.abc import Generator
from typing import Any
from uuid import UUID

from polar.backoffice.document import get_document

from ..schemas import SetupVerdictData


def _get_logfire_url(organization_id: UUID) -> str:
    """Generate logfire URL to view API logs for this organization."""
    params = {
        "q": f"attributes->>'subject_id' = '{organization_id}'",
        "last": "30d",
    }
    return f"https://logfire-us.pydantic.dev/polar/production?{urllib.parse.urlencode(params)}"


class SetupVerdict:
    """Component for evaluating organization integration setup status."""

    def __init__(self, data: SetupVerdictData, organization: Any = None) -> None:
        self.data = data
        self.organization = organization

    @contextlib.contextmanager
    def _render_detail_item(
        self, title: str, status: bool, count: int = 0, clickable: bool = False
    ) -> Generator[None]:
        """Render a detail item with status indicator."""
        classes = "flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
        if clickable:
            classes += " cursor-pointer"

        with doc.div(classes=classes):
            with doc.div(classes="flex items-center gap-2"):
                if status:
                    with doc.div(classes="w-2 h-2 rounded-full bg-green-500"):
                        pass
                else:
                    with doc.div(classes="w-2 h-2 rounded-full bg-red-500"):
                        pass
                with doc.span(
                    classes="text-sm font-medium text-gray-900 dark:text-gray-100"
                ):
                    doc.text(title)
            if count > 0:
                with doc.span(
                    classes="text-sm text-gray-600 dark:text-gray-400 font-medium"
                ):
                    doc.text(str(count))
        yield

    @contextlib.contextmanager
    def render(self) -> Generator[None]:

        
    doc = get_document()
            doc = get_document()
        """Render the setup verdict component."""
        with doc.div(classes="card-body"):
            with doc.h2(classes="card-title"):
                doc.text("Setup")

            # Setup details
            with doc.div(classes="space-y-2 mt-4"):
                # Checkout links
                checkout_count = self.data.checkout_links_count
                with self._render_detail_item(
                    "Checkout Links", checkout_count > 0, checkout_count, clickable=True
                ):
                    pass

                # Webhooks
                webhooks_count = self.data.webhooks_count
                with self._render_detail_item(
                    "Webhook Endpoints",
                    webhooks_count > 0,
                    webhooks_count,
                    clickable=True,
                ):
                    pass

                # API Keys
                api_keys_count = self.data.api_keys_count
                with self._render_detail_item(
                    "API Keys", api_keys_count > 0, api_keys_count, clickable=True
                ):
                    pass

                # Products
                products_count = self.data.products_count
                with self._render_detail_item(
                    "Products", products_count > 0, products_count, clickable=True
                ):
                    pass

                # Benefits
                benefits_count = self.data.benefits_count
                with self._render_detail_item(
                    "Benefits", benefits_count > 0, benefits_count, clickable=True
                ):
                    pass

            # Verification section
            with doc.div(classes="mt-4 pt-4 border-t border-gray-200"):
                with doc.div(classes="space-y-2"):
                    # User verification
                    user_verified = self.data.user_verified
                    with self._render_detail_item(
                        "User Verified in Stripe", user_verified
                    ):
                        pass

                    # Account setup
                    account_enabled = (
                        self.data.account_charges_enabled
                        and self.data.account_payouts_enabled
                    )
                    with self._render_detail_item(
                        "Account Charges & Payouts Enabled", account_enabled
                    ):
                        pass

            # API Logs link
            if self.organization:
                with doc.div(classes="mt-4 pt-4 border-t border-gray-200"):
                    with doc.a(
                        href=_get_logfire_url(self.organization.id),
                        target="_blank",
                        rel="noopener noreferrer",
                        classes="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
                    ):
                        doc.text("View API Logs in Logfire")
                        with doc.div(classes="icon-external-link"):
                            pass

        yield
