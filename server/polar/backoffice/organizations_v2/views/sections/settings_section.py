"""Settings section with organization configuration."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import button, card


class SettingsSection:
    """Render the settings section with configuration options."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the settings section."""

        with tag.div(classes="space-y-6"):
            # Basic settings card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Basic Settings")
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
                        text("Edit")

                with tag.div(classes="space-y-4"):
                    with tag.div(classes="grid grid-cols-2 gap-4"):
                        with tag.div():
                            with tag.div(classes="text-sm text-base-content/60 mb-1"):
                                text("Name")
                            with tag.div(classes="font-semibold"):
                                text(self.org.name)

                        with tag.div():
                            with tag.div(classes="text-sm text-base-content/60 mb-1"):
                                text("Slug")
                            with tag.div(classes="font-mono text-sm"):
                                text(self.org.slug)

                    with tag.div():
                        with tag.div(classes="text-sm text-base-content/60 mb-1"):
                            text("Email")
                        with tag.div(classes="text-sm"):
                            text(self.org.email or "Not set")

                    with tag.div():
                        with tag.div(classes="text-sm text-base-content/60 mb-1"):
                            text("Customer Invoice Prefix")
                        with tag.div(classes="font-mono text-sm"):
                            text(self.org.customer_invoice_prefix)

            # Order settings card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Order Settings")
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
                        text("Edit")

                with tag.div(classes="space-y-4"):
                    with tag.div():
                        with tag.div(classes="text-sm text-base-content/60 mb-1"):
                            text("Invoice Numbering")
                        with tag.div(classes="text-sm"):
                            invoice_numbering = self.org.order_settings.get(
                                "invoice_numbering", "organization"
                            )
                            numbering_label = (
                                "Organization-wide"
                                if invoice_numbering == "organization"
                                else "Per-customer"
                            )
                            text(numbering_label)

            # Feature flags card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Feature Flags")
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
                        text("Edit")

                with tag.div(classes="space-y-2"):
                    # Import OrganizationFeatureSettings to iterate over feature flags
                    from polar.organization.schemas import OrganizationFeatureSettings

                    feature_settings = self.org.feature_settings or {}
                    if feature_settings:
                        for (
                            field_name
                        ) in OrganizationFeatureSettings.model_fields.keys():
                            enabled = feature_settings.get(field_name, False)
                            label = field_name.replace("_", " ").title()

                            with tag.div(classes="flex items-center gap-2"):
                                # Status indicator
                                status_class = (
                                    "bg-success" if enabled else "bg-base-300"
                                )
                                with tag.div(
                                    classes=f"w-2 h-2 rounded-full {status_class}"
                                ):
                                    pass
                                with tag.div(classes="text-sm"):
                                    text(label)
                                with tag.div(
                                    classes="text-xs text-base-content/60 ml-auto"
                                ):
                                    text("Enabled" if enabled else "Disabled")
                    else:
                        with tag.div(
                            classes="text-sm text-base-content/60 text-center py-4"
                        ):
                            text("No feature flags configured")

            # Organization details card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Organization Details")
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
                        text("Edit")

                with tag.div(classes="space-y-4"):
                    # Website
                    if self.org.website:
                        with tag.div():
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

                    if hasattr(self.org, "details") and self.org.details:
                        details = self.org.details

                        if details.get("about"):
                            with tag.div():
                                with tag.div(classes="text-sm font-semibold mb-2"):
                                    text("About")
                                with tag.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    text(details["about"])

                        if details.get("product_description"):
                            with tag.div():
                                with tag.div(classes="text-sm font-semibold mb-2"):
                                    text("Product Description")
                                with tag.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    text(details["product_description"])

                        if details.get("intended_use"):
                            with tag.div():
                                with tag.div(classes="text-sm font-semibold mb-2"):
                                    text("Intended Use")
                                with tag.div(
                                    classes="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    text(details["intended_use"])
                    else:
                        with tag.div(
                            classes="text-sm text-base-content/60 text-center py-4"
                        ):
                            text("No details provided")

            # Social media links card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Social Media Links")
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
                        text("Edit")

                socials = self.org.socials or []
                if socials:
                    with tag.div(classes="space-y-3"):
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
                else:
                    with tag.div(
                        classes="text-sm text-base-content/60 text-center py-4"
                    ):
                        text("No social media links configured")

            # Danger zone card
            with card(bordered=True, classes="border-error/20 bg-error/5"):
                with tag.h2(classes="text-lg font-bold mb-4 text-error"):
                    text("Danger Zone")

                with tag.div(classes="space-y-3"):
                    with tag.div(classes="flex items-center justify-between"):
                        with tag.div():
                            with tag.div(classes="font-semibold text-sm"):
                                text("Delete Organization")
                            with tag.div(classes="text-xs text-base-content/60"):
                                text(
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
                            text("Delete")

            yield


__all__ = ["SettingsSection"]
