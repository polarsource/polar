"""Review section with account checklist and reply template."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import card


class ReviewSection:
    """Render the review section with account checklist and reply template."""

    def __init__(self, organization: Organization, orders_count: int = 0) -> None:
        self.org = organization
        self.orders_count = orders_count

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

    @contextlib.contextmanager
    def checklist_card(self) -> Generator[None]:
        """Render the account review checklist card."""
        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Account Review Checklist")

            with tag.div(classes="space-y-3"):
                # Support Email
                self._checklist_row(
                    "Support Email",
                    self.has_email,
                    self.org.email if self.has_email else None,
                )

                # Website URL
                self._checklist_row(
                    "Website URL",
                    self.has_website,
                    self.org.website if self.has_website else None,
                )

                # Social Media
                if self.has_socials:
                    social_count = len(self.org.socials)
                    self._checklist_row(
                        "Social Media",
                        True,
                        f"{social_count} link{'s' if social_count != 1 else ''}",
                    )
                else:
                    self._checklist_row("Social Media", False, None)

                # Test Sales (info row, not pass/fail)
                with tag.div(
                    classes="flex items-center justify-between py-2 border-b border-base-200"
                ):
                    with tag.div(classes="flex items-center gap-2"):
                        with tag.span(
                            classes="w-2.5 h-2.5 rounded-full bg-info inline-block"
                        ):
                            pass
                        with tag.span(classes="text-sm font-medium"):
                            text("Test Sales")
                    with tag.span(classes="text-sm"):
                        text(
                            f"{self.orders_count} order{'s' if self.orders_count != 1 else ''}"
                        )

                if self.orders_count > 0:
                    with tag.div(
                        classes="mt-2 p-3 bg-warning/10 border border-warning/30 rounded text-sm"
                    ):
                        text(
                            "This organization has orders that should be auto-refunded before approval."
                        )

            yield

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

    @contextlib.contextmanager
    def reply_template_card(self) -> Generator[None]:
        """Render the reply template card (only when items are missing)."""
        missing = self.missing_items
        if not missing:
            yield
            return

        template_lines = [
            "Hi,",
            "",
            "Thank you for setting up your account on Polar. Before we can approve your account, we need you to complete the following:",
            "",
        ]
        for item in missing:
            template_lines.append(f"- [ ] {item}")
        template_lines.extend(
            [
                "",
                "We'd also recommend creating a 100% discount code to test your checkout flow before going live.",
                "",
                "Best regards,",
                "Polar Team",
            ]
        )
        template_text = "\n".join(template_lines)

        # Escape for JS
        escaped = (
            template_text.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
        )

        with card(bordered=True):
            with tag.h2(classes="text-lg font-bold mb-4"):
                text("Review Reply Template")

            with tag.pre(
                classes="text-sm bg-base-200 p-4 rounded whitespace-pre-wrap mb-4"
            ):
                text(template_text)

            with tag.button(
                classes="btn btn-sm btn-outline",
                onclick=f"navigator.clipboard.writeText(`{escaped}`); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy to Clipboard', 1000)",
            ):
                text("Copy to Clipboard")

            yield

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the complete review section."""
        with tag.div(classes="space-y-6"):
            with self.checklist_card():
                pass

            with self.reply_template_card():
                pass

            yield


__all__ = ["ReviewSection"]
