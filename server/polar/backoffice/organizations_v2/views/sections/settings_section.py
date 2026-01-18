"""Settings section with organization configuration."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from markupflow import Fragment

from polar.models import Organization

from ....components import button, card


class SettingsSection:
    """Render the settings section with configuration options."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[Fragment]:
        """Render the settings section."""
        fragment = Fragment()

        with fragment.div(class_="space-y-6"):
            # Basic settings card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Basic Settings")
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
                        fragment.text("Edit")

                with fragment.div(class_="space-y-4"):
                    with fragment.div(class_="grid grid-cols-2 gap-4"):
                        with fragment.div():
                            with fragment.div(
                                class_="text-sm text-base-content/60 mb-1"
                            ):
                                fragment.text("Name")
                            with fragment.div(class_="font-semibold"):
                                fragment.text(self.org.name)

                        with fragment.div():
                            with fragment.div(
                                class_="text-sm text-base-content/60 mb-1"
                            ):
                                fragment.text("Slug")
                            with fragment.div(class_="font-mono text-sm"):
                                fragment.text(self.org.slug)

                    with fragment.div():
                        with fragment.div(class_="text-sm text-base-content/60 mb-1"):
                            fragment.text("Email")
                        with fragment.div(class_="text-sm"):
                            fragment.text(self.org.email or "Not set")

                    with fragment.div():
                        with fragment.div(class_="text-sm text-base-content/60 mb-1"):
                            fragment.text("Customer Invoice Prefix")
                        with fragment.div(class_="font-mono text-sm"):
                            fragment.text(self.org.customer_invoice_prefix)

            # Order settings card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Order Settings")
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
                        fragment.text("Edit")

                with fragment.div(class_="space-y-4"):
                    with fragment.div():
                        with fragment.div(class_="text-sm text-base-content/60 mb-1"):
                            fragment.text("Invoice Numbering")
                        with fragment.div(class_="text-sm"):
                            invoice_numbering = self.org.order_settings.get(
                                "invoice_numbering", "organization"
                            )
                            numbering_label = (
                                "Organization-wide"
                                if invoice_numbering == "organization"
                                else "Per-customer"
                            )
                            fragment.text(numbering_label)

            # Feature flags card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Feature Flags")
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
                        fragment.text("Edit")

                with fragment.div(class_="space-y-2"):
                    # Import OrganizationFeatureSettings to iterate over feature flags
                    from polar.organization.schemas import OrganizationFeatureSettings

                    feature_settings = self.org.feature_settings or {}
                    if feature_settings:
                        for (
                            field_name
                        ) in OrganizationFeatureSettings.model_fields.keys():
                            enabled = feature_settings.get(field_name, False)
                            label = field_name.replace("_", " ").title()

                            with fragment.div(class_="flex items-center gap-2"):
                                # Status indicator
                                status_class = (
                                    "bg-success" if enabled else "bg-base-300"
                                )
                                with fragment.div(
                                    class_=f"w-2 h-2 rounded-full {status_class}"
                                ):
                                    pass
                                with fragment.div(class_="text-sm"):
                                    fragment.text(label)
                                with fragment.div(
                                    class_="text-xs text-base-content/60 ml-auto"
                                ):
                                    fragment.text("Enabled" if enabled else "Disabled")
                    else:
                        with fragment.div(
                            class_="text-sm text-base-content/60 text-center py-4"
                        ):
                            fragment.text("No feature flags configured")

            # Organization details card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Organization Details")
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
                        fragment.text("Edit")

                with fragment.div(class_="space-y-4"):
                    # Website
                    if self.org.website:
                        with fragment.div():
                            with fragment.div(class_="text-sm font-semibold mb-2"):
                                fragment.text("Website")
                            with fragment.div(class_="text-sm text-base-content/80"):
                                with fragment.a(
                                    href=str(self.org.website),
                                    target="_blank",
                                    rel="noopener noreferrer",
                                    class_="link link-primary",
                                ):
                                    fragment.text(str(self.org.website))

                    if hasattr(self.org, "details") and self.org.details:
                        details = self.org.details

                        if details.get("about"):
                            with fragment.div():
                                with fragment.div(class_="text-sm font-semibold mb-2"):
                                    fragment.text("About")
                                with fragment.div(
                                    class_="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    fragment.text(details["about"])

                        if details.get("product_description"):
                            with fragment.div():
                                with fragment.div(class_="text-sm font-semibold mb-2"):
                                    fragment.text("Product Description")
                                with fragment.div(
                                    class_="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    fragment.text(details["product_description"])

                        if details.get("intended_use"):
                            with fragment.div():
                                with fragment.div(class_="text-sm font-semibold mb-2"):
                                    fragment.text("Intended Use")
                                with fragment.div(
                                    class_="text-sm text-base-content/80 whitespace-pre-wrap"
                                ):
                                    fragment.text(details["intended_use"])
                    else:
                        with fragment.div(
                            class_="text-sm text-base-content/60 text-center py-4"
                        ):
                            fragment.text("No details provided")

            # Social media links card
            with card(bordered=True):
                with fragment.div(class_="flex items-center justify-between mb-4"):
                    with fragment.h2(class_="text-lg font-bold"):
                        fragment.text("Social Media Links")
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
                        fragment.text("Edit")

                socials = self.org.socials or []
                if socials:
                    with fragment.div(class_="space-y-3"):
                        for social in socials:
                            platform = social.get("platform", "").title()
                            url = social.get("url", "")
                            if platform and url:
                                with fragment.div(
                                    class_="flex items-center justify-between py-1.5"
                                ):
                                    with fragment.span(
                                        class_="text-sm font-medium capitalize"
                                    ):
                                        fragment.text(platform)
                                    with fragment.a(
                                        href=url,
                                        target="_blank",
                                        rel="noopener noreferrer",
                                        class_="text-sm link link-primary truncate max-w-xs",
                                    ):
                                        fragment.text(url)
                else:
                    with fragment.div(
                        class_="text-sm text-base-content/60 text-center py-4"
                    ):
                        fragment.text("No social media links configured")

            # Danger zone card
            with card(bordered=True, classes="border-error/20 bg-error/5"):
                with fragment.h2(class_="text-lg font-bold mb-4 text-error"):
                    fragment.text("Danger Zone")

                with fragment.div(class_="space-y-3"):
                    with fragment.div(class_="flex items-center justify-between"):
                        with fragment.div():
                            with fragment.div(class_="font-semibold text-sm"):
                                fragment.text("Delete Organization")
                            with fragment.div(class_="text-xs text-base-content/60"):
                                fragment.text(
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
                            fragment.text("Delete")

            yield fragment


__all__ = ["SettingsSection"]
