"""Shared constants and helpers for organization review sections."""

from __future__ import annotations

from typing import TYPE_CHECKING

from tagflow import tag, text

if TYPE_CHECKING:
    from polar.models import Organization
    from polar.organization_review.schemas import DimensionAssessment

# DaisyUI badge class for each RiskLevel value
RISK_LEVEL_BADGE: dict[str, str] = {
    "LOW": "badge-ghost",
    "MEDIUM": "badge-warning",
    "HIGH": "badge-error",
}

# DaisyUI badge class for each ReviewVerdict value
VERDICT_BADGE: dict[str, str] = {
    "APPROVE": "badge-success",
    "DENY": "badge-error",
    "NEEDS_HUMAN_REVIEW": "badge-warning",
}


def render_checklist_row(label: str, is_set: bool, value: str | None) -> None:
    """Render a single checklist row with a green/red status dot."""
    with tag.div(
        classes="flex items-center justify-between py-2 border-b border-base-200"
    ):
        with tag.div(classes="flex items-center gap-2"):
            dot_class = "bg-success" if is_set else "bg-error"
            with tag.span(classes=f"w-2.5 h-2.5 rounded-full {dot_class} inline-block"):
                pass
            with tag.span(classes="text-sm font-medium"):
                text(label)
        with tag.span(
            classes="text-sm" + (" text-base-content/60" if not is_set else "")
        ):
            text((value or "Set") if is_set else "Missing")


def render_dimension(dim: DimensionAssessment) -> None:
    """Render a single dimension assessment card."""
    name = dim.dimension.value.replace("_", " ").title()

    badge_class = RISK_LEVEL_BADGE.get(dim.risk_level.value, "badge-ghost")

    with tag.div(classes="border border-base-200 rounded p-3"):
        with tag.div(classes="flex items-center justify-between mb-1"):
            with tag.span(classes="text-sm font-medium"):
                text(name)
            with tag.div(classes="flex items-center gap-2"):
                with tag.div(classes=f"badge badge-sm {badge_class}"):
                    text(dim.risk_level.value)
                with tag.span(classes="text-xs text-base-content/60"):
                    text(f"{dim.confidence:.0%} confidence")

        if dim.findings:
            with tag.ul(classes="list-disc list-inside text-xs space-y-0.5 mt-1"):
                for finding in dim.findings:
                    with tag.li():
                        text(finding)

        if dim.recommendation:
            with tag.p(classes="text-xs text-base-content/60 mt-1 italic"):
                text(dim.recommendation)


class ChecklistMixin:
    """Mixin providing checklist properties for sections that have self.org."""

    org: Organization

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
