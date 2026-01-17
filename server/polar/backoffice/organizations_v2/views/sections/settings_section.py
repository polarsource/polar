"""Settings section with organization configuration."""

import contextlib
from collections.abc import Generator

from fastapi import Request

from polar.models import Organization

from ....components import button, card
from polar.backoffice.document import get_document


class SettingsSection:
    """Render the settings section with configuration options."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:

        
        doc = get_document()
            doc = get_document()
        """Render the settings section."""

        with doc.div(classes="space-y-6"):
            # Basic settings card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Basic Settings")
                    with button(
                        variant="secondary",
                        size="sm",
                        ghost=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:edit", organization_id=self.org.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        doc.text("Edit")

                with doc.div(classes="space-y-4"):
                    with doc.div(classes="grid grid-cols-2 gap-4"):
                        with doc.div():
                            with doc.div(classes="text-sm text-base-content/60 mb-1"):
                                doc.text("Name")
                            with doc.div(classes="font-semibold"):
                                doc.text(self.org.name)

                        with doc.div():
                            with doc.div(classes="text-sm text-base-content/60 mb-1"):
                                doc.text("Slug")
                            with doc.div(classes="font-mono text-sm"):
                                doc.text(self.org.slug)

                    with doc.div():
                        with doc.div(classes="text-sm text-base-content/60 mb-1"):
                            doc.text("Email")
                        with doc.div(classes="text-sm"):
                            doc.text(self.org.email or "Not set")

                    with doc.div():
                        with doc.div(classes="text-sm text-base-content/60 mb-1"):
                            doc.text("Customer Invoice Prefix")
                        with doc.div(classes="font-mono text-sm"):
                            doc.text(self.org.customer_invoice_prefix)

            # Order settings card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Order Settings")
                    with button(
                        variant="secondary",
                        size="sm",
                        ghost=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:edit_order_settings",
                                organization_id=self.org.id,
                            )
                        ),
                        hx_target="#modal",
                    ):
                        doc.text("Edit")

                with doc.div(classes="space-y-4"):
                    with doc.div():
                        with doc.div(classes="text-sm text-base-content/60 mb-1"):
                            doc.text("Invoice Numbering")
                        with doc.div(classes="text-sm"):
                            invoice_numbering = self.org.order_settings.get(
                                "invoice_numbering", "organization"
                            )
                            numbering_label = (
                                "Organization-wide"
                                if invoice_numbering == "organization"
                                else "Per-customer"
                            )
                            doc.text(numbering_label)

            # Feature flags card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Feature Flags")
                    with button(
                        variant="secondary",
                        size="sm",
                        ghost=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:edit_features",
                                organization_id=self.org.id,
                            )
                        ),
                        hx_target="#modal",
                    ):
                        doc.text("Edit")

                with doc.div(classes="space-y-2"):
                    # Import OrganizationFeatureSettings to iterate over feature flags
                    from polar.organization.schemas import OrganizationFeatureSettings

                    feature_settings = self.org.feature_settings or {}
                    if feature_settings:
                        for (
                            field_name
                        ) in OrganizationFeatureSettings.model_fields.keys():
                            enabled = feature_settings.get(field_name, False)
                            label = field_name.replace("_", " ").title()

                            with doc.div(classes="flex items-center gap-2"):
                                # Status indicator
                                status_class = (
                                    "bg-success" if enabled else "bg-base-300"
                                )
                                with doc.div(
                                    classes=f"w-2 h-2 rounded-full {status_class}"
                                ):
                                    pass
                                with doc.div(classes="text-sm"):
                                    doc.text(label)
                                with doc.div(
                                    classes="text-xs text-base-content/60 ml-auto"
                                ):
                                    doc.text("Enabled" if enabled else "Disabled")
                    else:
                        with doc.div(
                            classes="text-sm text-base-content/60 text-center py-4"
                        ):
                            doc.text("No feature flags configured")

            # Organization details card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Organization Details")
                    with button(
                        variant="secondary",
                        size="sm",
                        ghost=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:edit_details",
                                organization_id=self.org.id,
                            )
                        ),
                        hx_target="#modal",
                    ):
                        doc.text("Edit")

                with doc.div(classes="space-y-4"):
                    # Website
                    if self.org.website:
                        with doc.div():
                            with doc.div(classes="text-sm font-semibold mb-2"):
                                doc.text("Website")
                            with doc.div(classes="text-sm text-base-content/80"):
                                with doc.a(
                                    href=str(self.org.website),
                                    target="_blank",
                                    rel="noopener noreferrer",
                                    classes="link link-primary",
                                ):
                                    doc.text(str(self.org.website))

                    if hasattr(self.org, "details") and self.org.details:
                        details = self.org.details

                        if details.get("about"):
                            with doc.div():
                                with doc.div(classes="text-sm font-semibold mb-2"):
                                    doc.text("About")
                                with doc.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    doc.text(details["about"])

                        if details.get("product_description"):
                            with doc.div():
                                with doc.div(classes="text-sm font-semibold mb-2"):
                                    doc.text("Product Description")
                                with doc.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    doc.text(details["product_description"])

                        if details.get("intended_use"):
                            with doc.div():
                                with doc.div(classes="text-sm font-semibold mb-2"):
                                    doc.text("Intended Use")
                                with doc.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    doc.text(details["intended_use"])
                    else:
                        with doc.div(
                            classes="text-sm text-base-content/60 text-center py-4"
                        ):
                            doc.text("No details provided")

            # Social media links card
            with card(bordered=True):
                with doc.div(classes="flex items-center justify-between mb-4"):
                    with doc.h2(classes="text-lg font-bold"):
                        doc.text("Social Media Links")
                    with button(
                        variant="secondary",
                        size="sm",
                        ghost=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:edit_socials",
                                organization_id=self.org.id,
                            )
                        ),
                        hx_target="#modal",
                    ):
                        doc.text("Edit")

                socials = self.org.socials or []
                if socials:
                    with doc.div(classes="space-y-3"):
                        for social in socials:
                            platform = social.get("platform", "").title()
                            url = social.get("url", "")
                            if platform and url:
                                with doc.div(
                                    classes="flex items-center justify-between py-1.5"
                                ):
                                    with doc.span(
                                        classes="text-sm font-medium capitalize"
                                    ):
                                        doc.text(platform)
                                    with doc.a(
                                        href=url,
                                        target="_blank",
                                        rel="noopener noreferrer",
                                        classes="text-sm link link-primary truncate max-w-xs",
                                    ):
                                        doc.text(url)
                else:
                    with doc.div(
                        classes="text-sm text-base-content/60 text-center py-4"
                    ):
                        doc.text("No social media links configured")

            # Danger zone card
            with card(bordered=True, classes="border-error/20 bg-error/5"):
                with doc.h2(classes="text-lg font-bold mb-4 text-error"):
                    doc.text("Danger Zone")

                with doc.div(classes="space-y-3"):
                    with doc.div(classes="flex items-center justify-between"):
                        with doc.div():
                            with doc.div(classes="font-semibold text-sm"):
                                doc.text("Delete Organization")
                            with doc.div(classes="text-xs text-base-content/60"):
                                doc.text(
                                    "Permanently delete this organization and all associated data"
                                )

                        with button(
                            variant="error",
                            size="sm",
                            outline=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:delete_dialog",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            doc.text("Delete")

            yield


__all__ = ["SettingsSection"]
