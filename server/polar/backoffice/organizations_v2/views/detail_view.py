"""Organization detail view with horizontal tabs and sidebar."""

import contextlib
import urllib.parse
from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization
from polar.models.organization import OrganizationStatus

from ...components import (
    Tab,
    button,
    card,
    status_badge,
    tab_nav,
)
from ...components._clipboard_button import clipboard_button


def _get_logfire_url(organization_id: UUID) -> str:
    params = {
        "q": f"attributes->>'subject_id' = '{organization_id}'",
        "last": "30d",
    }
    return (
        f"https://logfire-us.pydantic.dev/polar/polar?{urllib.parse.urlencode(params)}"
    )


class OrganizationDetailView:
    """Render the organization detail view with horizontal section tabs."""

    def __init__(
        self, organization: Organization, ai_verdict: str = ""
    ):
        self.org = organization
        self.ai_verdict = ai_verdict

    @contextlib.contextmanager
    def section_tabs(
        self, request: Request, current_section: str = "overview"
    ) -> Generator[None]:
        """Render horizontal section navigation tabs."""
        tabs = [
            Tab(
                "Overview",
                str(
                    request.url_for("organizations:detail", organization_id=self.org.id)
                )
                + "?section=overview",
                active=current_section == "overview",
            ),
            Tab(
                "Team",
                str(
                    request.url_for("organizations:detail", organization_id=self.org.id)
                )
                + "?section=team",
                active=current_section == "team",
            ),
            Tab(
                "Account",
                str(
                    request.url_for("organizations:detail", organization_id=self.org.id)
                )
                + "?section=account",
                active=current_section == "account",
            ),
            Tab(
                "Files",
                str(
                    request.url_for("organizations:detail", organization_id=self.org.id)
                )
                + "?section=files",
                active=current_section == "files",
            ),
            Tab(
                "Settings",
                str(
                    request.url_for("organizations:detail", organization_id=self.org.id)
                )
                + "?section=settings",
                active=current_section == "settings",
            ),
        ]

        with tab_nav(tabs):
            pass
        yield

    @contextlib.contextmanager
    def right_sidebar(self, request: Request) -> Generator[None]:
        """Render right sidebar with contextual actions and metadata."""
        with tag.aside(classes="w-80 pl-4"):
            # Internal Notes - Prominent at top
            if self.org.internal_notes:
                with card(bordered=True, classes="border-l-4 border-l-base-400 mb-4"):
                    with tag.h3(
                        classes="font-bold text-sm uppercase tracking-wide mb-3"
                    ):
                        text("Internal Note")
                    with tag.div(
                        classes="text-sm whitespace-pre-wrap text-base-content/90 leading-relaxed"
                    ):
                        text(self.org.internal_notes)
                    with tag.div(classes="mt-3 pt-3 border-t border-base-300"):
                        with button(
                            variant="secondary",
                            size="sm",
                            ghost=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations:edit_note",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Edit Note")
            else:
                with card(bordered=True, classes="mb-4"):
                    with tag.h3(
                        classes="font-bold text-sm uppercase tracking-wide mb-3"
                    ):
                        text("Internal Note")
                    with tag.div(classes="text-sm text-base-content/60 mb-3"):
                        text("No internal notes")
                    with button(
                        variant="secondary",
                        size="sm",
                        outline=True,
                        hx_get=str(
                            request.url_for(
                                "organizations:add_note", organization_id=self.org.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        text("Add Note")

            # Actions card
            with card(bordered=True, classes="mb-4"):
                with tag.h3(classes="font-bold text-sm uppercase tracking-wide mb-3"):
                    text("Actions")

                with tag.div(classes="space-y-2"):
                    # Check if organization is blocked
                    is_blocked = self.org.blocked_at is not None

                    # Context-aware actions based on status
                    if is_blocked:
                        # Blocked organizations can be unblocked and approved
                        with tag.div(classes="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations:unblock_approve_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Unblock & Approve")

                    elif self.org.status == OrganizationStatus.DENIED:
                        # Denied organizations can be approved
                        with tag.div(classes="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations:approve_denied_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Approve")

                    elif self.org.status == OrganizationStatus.ACTIVE:
                        # Active organizations can be denied or set under review
                        with tag.div(classes="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations:under_review_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Set Under Review")

                        with tag.div(classes="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations:deny_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Deny")

                    elif self.org.is_under_review:
                        # Compute suggested threshold: double current or $250 min
                        current_threshold = self.org.next_review_threshold or 0
                        suggested_threshold = max(25000, current_threshold * 2)
                        threshold_dollars = suggested_threshold // 100
                        is_override = self.ai_verdict == "DENY"

                        if is_override:
                            # AI disagrees: open modal for reason + threshold
                            with tag.div(classes="w-full"):
                                with button(
                                    variant="secondary",
                                    size="sm",
                                    outline=True,
                                    hx_get=str(
                                        request.url_for(
                                            "organizations:approve_dialog",
                                            organization_id=self.org.id,
                                        )
                                    ),
                                    hx_target="#modal",
                                ):
                                    text("Approve")
                        else:
                            # AI agrees: inline threshold input + approve button
                            with tag.form(
                                hx_post=str(
                                    request.url_for(
                                        "organizations:approve_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                classes="w-full flex gap-2 items-center",
                            ):
                                with tag.div(classes="flex items-center gap-1 flex-1"):
                                    with tag.span(classes="text-sm text-base-content/60"):
                                        text("$")
                                    with tag.input(
                                        type="number",
                                        name="threshold",
                                        value=str(threshold_dollars),
                                        classes="input input-bordered input-sm w-full",
                                    ):
                                        pass
                                with button(
                                    variant="secondary",
                                    size="sm",
                                    outline=True,
                                    type="submit",
                                ):
                                    text("Approve")

                        with tag.div(classes="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations:deny_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Deny")

                    # Always available actions
                    with tag.div(classes="divider my-2"):
                        pass

                    with tag.div(classes="w-full"):
                        with button(
                            variant="secondary",
                            size="sm",
                            outline=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations:detail",
                                    organization_id=self.org.id,
                                )
                            )
                            + "/plain-thread",
                            hx_target="#modal",
                        ):
                            text("Create Plain Thread")

                    with tag.div(classes="w-full"):
                        with button(
                            variant="secondary",
                            size="sm",
                            outline=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations:block_dialog",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Block Organization")

            # Metadata card
            with card(bordered=True):
                with tag.h3(classes="font-bold text-sm uppercase tracking-wide mb-3"):
                    text("Metadata")

                with tag.dl(classes="space-y-3 text-sm"):
                    # Slug (copyable)
                    with tag.div():
                        with tag.dt(classes="text-base-content/60 mb-1"):
                            text("Slug")
                        with tag.dd(classes="flex items-center gap-2"):
                            with tag.code(
                                classes="font-mono text-xs bg-base-200 px-2 py-1 rounded flex-1"
                            ):
                                text(self.org.slug)
                            with clipboard_button(self.org.slug):
                                pass

                    # ID (copyable)
                    with tag.div():
                        with tag.dt(classes="text-base-content/60 mb-1"):
                            text("Organization ID")
                        with tag.dd(classes="flex items-center gap-2"):
                            with tag.code(
                                classes="font-mono text-xs bg-base-200 px-2 py-1 rounded flex-1 break-all"
                            ):
                                text(str(self.org.id))
                            with clipboard_button(str(self.org.id)):
                                pass

                    # Created
                    with tag.div():
                        with tag.dt(classes="text-base-content/60 mb-1"):
                            text("Created")
                        with tag.dd(classes="font-semibold"):
                            days_ago = (datetime.now(UTC) - self.org.created_at).days
                            text(f"{days_ago}d ago")

                    # Status duration
                    if self.org.status_updated_at:
                        with tag.div():
                            with tag.dt(classes="text-base-content/60 mb-1"):
                                text("In Status")
                            with tag.dd(classes="font-semibold"):
                                days = (
                                    datetime.now(UTC) - self.org.status_updated_at
                                ).days
                                text(f"{days} days")

                    # Country
                    if self.org.account and self.org.account.country:
                        with tag.div():
                            with tag.dt(classes="text-base-content/60 mb-1"):
                                text("Country")
                            with tag.dd(classes="font-semibold"):
                                text(self.org.account.country)

            yield

    @contextlib.contextmanager
    def main_content(
        self, request: Request, section: str = "overview"
    ) -> Generator[None]:
        """Render main content area (delegated to section components)."""
        with tag.main(classes="flex-1"):
            # Section content will be rendered by specific section components
            yield

    @contextlib.contextmanager
    def render(self, request: Request, section: str = "overview") -> Generator[None]:
        """Render the complete detail view with top tabs."""

        # Header
        with tag.div(classes="mb-6"):
            with tag.div(classes="flex items-center justify-between gap-4"):
                with tag.div(classes="flex items-center gap-3 min-w-0 flex-1"):
                    with tag.h1(
                        classes="text-3xl font-bold truncate",
                        title=self.org.name,
                    ):
                        text(self.org.name)
                    with tag.div(classes="flex-shrink-0"):
                        with status_badge(self.org.status):
                            pass

                with tag.a(
                    href=str(
                        request.url_for("organizations-classic:get", id=self.org.id)
                    ),
                    classes="btn btn-ghost btn-sm",
                ):
                    text("Switch to Classic View")

                # Top-right menu
                with tag.div(classes="dropdown dropdown-end"):
                    with tag.button(
                        classes="btn btn-circle btn-ghost",
                        tabindex="0",
                        **{"aria-label": "More options"},
                    ):
                        text("⋮")
                    with tag.ul(
                        classes="dropdown-content menu shadow bg-base-100 rounded-box w-56 z-10",
                        tabindex="0",
                    ):
                        with tag.li():
                            with tag.a(
                                hx_post=str(
                                    request.url_for(
                                        "organizations:run_review_agent",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_confirm="Run organization review agent?",
                            ):
                                text("Run Review Agent")
                        with tag.li():
                            with tag.a(
                                href=f"https://app.plain.com/workspace/w_01JE9TRRX9KT61D8P2CH77XDQM/search/?q={self.org.email or self.org.slug}",
                                target="_blank",
                            ):
                                text("Search in Plain")
                        with tag.li():
                            with tag.a(
                                href=_get_logfire_url(self.org.id),
                                target="_blank",
                            ):
                                text("View API Logs in Logfire")
                        with tag.li(classes="border-t border-base-200 mt-1 pt-1"):
                            with tag.a(
                                hx_get=str(
                                    request.url_for(
                                        "organizations:delete_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Delete Organization")

        # Section tabs
        with tag.div(classes="mb-6"):
            with self.section_tabs(request, section):
                pass

        # Two-column layout: main content + right sidebar
        with tag.div(classes="flex gap-6"):
            # Main content (will be filled by section components)
            with self.main_content(request, section):
                yield

            # Right sidebar
            with self.right_sidebar(request):
                pass


__all__ = ["OrganizationDetailView"]
