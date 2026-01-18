"""Organization detail view with horizontal tabs and sidebar."""

import contextlib
from collections.abc import Generator
from datetime import UTC, datetime

from fastapi import Request
from markupflow import Fragment

from polar.models import Organization
from polar.models.organization import OrganizationStatus

from ...components import (
    Tab,
    button,
    card,
    status_badge,
    tab_nav,
)


class OrganizationDetailView:
    """Render the organization detail view with horizontal section tabs."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def section_tabs(
        self, request: Request, current_section: str = "overview"
    ) -> Generator[Fragment]:
        """Render horizontal section navigation tabs."""
        tabs = [
            Tab(
                "Overview",
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=self.org.id
                    )
                )
                + "?section=overview",
                active=current_section == "overview",
            ),
            Tab(
                "Team",
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=self.org.id
                    )
                )
                + "?section=team",
                active=current_section == "team",
            ),
            Tab(
                "Account",
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=self.org.id
                    )
                )
                + "?section=account",
                active=current_section == "account",
            ),
            Tab(
                "Files",
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=self.org.id
                    )
                )
                + "?section=files",
                active=current_section == "files",
            ),
            Tab(
                "Settings",
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=self.org.id
                    )
                )
                + "?section=settings",
                active=current_section == "settings",
            ),
        ]

        fragment = Fragment()
        with tab_nav(tabs) as nav:
            pass
        yield fragment

    @contextlib.contextmanager
    def right_sidebar(self, request: Request) -> Generator[Fragment]:
        """Render right sidebar with contextual actions and metadata."""
        fragment = Fragment()
        with fragment.aside(class_="w-80 pl-4"):
            # Internal Notes - Prominent at top
            if self.org.internal_notes:
                with card(bordered=True, class_="border-l-4 border-l-base-400 mb-4"):
                    with fragment.h3(
                        class_="font-bold text-sm uppercase tracking-wide mb-3"
                    ):
                        fragment.text("Internal Note")
                    with fragment.div(
                        class_="text-sm whitespace-pre-wrap text-base-content/90 leading-relaxed"
                    ):
                        fragment.text(self.org.internal_notes)
                    with fragment.div(class_="mt-3 pt-3 border-t border-base-300"):
                        with button(
                            variant="secondary",
                            size="sm",
                            ghost=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:edit_note",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            fragment.text("Edit Note")
            else:
                with card(bordered=True, class_="mb-4"):
                    with fragment.h3(
                        class_="font-bold text-sm uppercase tracking-wide mb-3"
                    ):
                        fragment.text("Internal Note")
                    with fragment.div(class_="text-sm text-base-content/60 mb-3"):
                        fragment.text("No internal notes")
                    with button(
                        variant="secondary",
                        size="sm",
                        outline=True,
                        hx_get=str(
                            request.url_for(
                                "organizations-v2:add_note", organization_id=self.org.id
                            )
                        ),
                        hx_target="#modal",
                    ):
                        fragment.text("Add Note")

            # Actions card
            with card(bordered=True, class_="mb-4"):
                with fragment.h3(class_="font-bold text-sm uppercase tracking-wide mb-3"):
                    fragment.text("Actions")

                with fragment.div(class_="space-y-2"):
                    # Check if organization is blocked
                    is_blocked = self.org.blocked_at is not None

                    # Context-aware actions based on status
                    if is_blocked:
                        # Blocked organizations can be unblocked and approved
                        with fragment.div(class_="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:unblock_approve_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                fragment.text("Unblock & Approve")

                    elif self.org.status == OrganizationStatus.DENIED:
                        # Denied organizations can be approved
                        with fragment.div(class_="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:approve_denied_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                fragment.text("Approve")

                    elif self.org.status == OrganizationStatus.ACTIVE:
                        # Active organizations can be denied
                        with fragment.div(class_="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:deny_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                fragment.text("Deny")

                    elif self.org.is_under_review:
                        # Quick approve with doubled threshold
                        # Use current threshold (in cents) or $250 default, then double it
                        current_threshold = self.org.next_review_threshold or 25000
                        next_threshold = current_threshold * 2
                        next_threshold_display = f"${next_threshold / 100:,.0f}"

                        with fragment.div(class_="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_post=str(
                                    request.url_for(
                                        "organizations-v2:approve",
                                        organization_id=self.org.id,
                                    )
                                )
                                + f"?threshold={next_threshold}",
                                hx_confirm=f"Approve this organization with {next_threshold_display} threshold?",
                            ):
                                fragment.text(f"Approve ({next_threshold_display})")

                        # Custom approve with input
                        approve_url = str(
                            request.url_for(
                                "organizations-v2:approve", organization_id=self.org.id
                            )
                        )
                        with fragment.div(class_="flex gap-2"):
                            with fragment.input(
                                type="number",
                                id="custom-threshold",
                                placeholder="Custom amount",
                                class_="input input-bordered input-sm flex-1",
                            ):
                                pass
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                onclick=f"const amount = document.getElementById('custom-threshold').value; if(amount && confirm('Approve with $' + amount + ' threshold?')) {{ htmx.ajax('POST', '{approve_url}?threshold=' + (amount * 100), {{target: 'body'}}); }}",
                            ):
                                fragment.text("✓")

                        with fragment.div(class_="w-full"):
                            with button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:deny_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                fragment.text("Deny")

                    # Always available actions
                    with fragment.div(class_="divider my-2"):
                        pass

                    with fragment.div(class_="w-full"):
                        with button(
                            variant="secondary",
                            size="sm",
                            outline=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:detail",
                                    organization_id=self.org.id,
                                )
                            )
                            + "/plain-thread",
                            hx_target="#modal",
                        ):
                            fragment.text("Create Plain Thread")

                    with fragment.div(class_="w-full"):
                        with button(
                            variant="secondary",
                            size="sm",
                            outline=True,
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:block_dialog",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            fragment.text("Block Organization")

            # Metadata card
            with card(bordered=True):
                with fragment.h3(class_="font-bold text-sm uppercase tracking-wide mb-3"):
                    fragment.text("Metadata")

                with fragment.dl(class_="space-y-3 text-sm"):
                    # Slug (copyable)
                    with fragment.div():
                        with fragment.dt(class_="text-base-content/60 mb-1"):
                            fragment.text("Slug")
                        with fragment.dd(class_="flex items-center gap-2"):
                            with fragment.code(
                                class_="font-mono text-xs bg-base-200 px-2 py-1 rounded flex-1"
                            ):
                                fragment.text(self.org.slug)
                            with button(
                                variant="secondary",
                                size="sm",
                                ghost=True,
                                onclick=f"navigator.clipboard.writeText('{self.org.slug}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 1000)",
                            ):
                                fragment.text("Copy")

                    # ID (copyable)
                    with fragment.div():
                        with fragment.dt(class_="text-base-content/60 mb-1"):
                            fragment.text("Organization ID")
                        with fragment.dd(class_="flex items-center gap-2"):
                            with fragment.code(
                                class_="font-mono text-xs bg-base-200 px-2 py-1 rounded flex-1 break-all"
                            ):
                                fragment.text(str(self.org.id))
                            with button(
                                variant="secondary",
                                size="sm",
                                ghost=True,
                                onclick=f"navigator.clipboard.writeText('{self.org.id}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy', 1000)",
                            ):
                                fragment.text("Copy")

                    # Created
                    with fragment.div():
                        with fragment.dt(class_="text-base-content/60 mb-1"):
                            fragment.text("Created")
                        with fragment.dd(class_="font-semibold"):
                            days_ago = (datetime.now(UTC) - self.org.created_at).days
                            fragment.text(f"{days_ago}d ago")

                    # Status duration
                    if self.org.status_updated_at:
                        with fragment.div():
                            with fragment.dt(class_="text-base-content/60 mb-1"):
                                fragment.text("In Status")
                            with fragment.dd(class_="font-semibold"):
                                days = (
                                    datetime.now(UTC) - self.org.status_updated_at
                                ).days
                                fragment.text(f"{days} days")

                    # Country
                    if self.org.account and self.org.account.country:
                        with fragment.div():
                            with fragment.dt(class_="text-base-content/60 mb-1"):
                                fragment.text("Country")
                            with fragment.dd(class_="font-semibold"):
                                fragment.text(self.org.account.country)

        yield fragment

    @contextlib.contextmanager
    def main_content(
        self, request: Request, section: str = "overview"
    ) -> Generator[Fragment]:
        """Render main content area (delegated to section components)."""
        fragment = Fragment()
        with fragment.main(class_="flex-1"):
            # Section content will be rendered by specific section components
            yield fragment

    @contextlib.contextmanager
    def render(self, request: Request, section: str = "overview") -> Generator[Fragment]:
        """Render the complete detail view with top tabs."""
        fragment = Fragment()

        # Back button and header
        with fragment.div(class_="mb-6"):
            with fragment.a(
                href=str(request.url_for("organizations-v2:list")),
                class_="text-sm text-base-content/60 hover:text-base-content mb-2 inline-block",
            ):
                fragment.text("← Back to Organizations")

            with fragment.div(class_="flex items-center justify-between gap-4"):
                with fragment.div(class_="flex items-center gap-3 min-w-0 flex-1"):
                    with fragment.h1(
                        class_="text-3xl font-bold truncate",
                        title=self.org.name,
                    ):
                        fragment.text(self.org.name)
                    with fragment.div(class_="flex-shrink-0"):
                        with status_badge(self.org.status):
                            pass

                # Top-right menu
                with fragment.div(class_="dropdown dropdown-end"):
                    with fragment.button(
                        class_="btn btn-circle btn-ghost",
                        **{"aria-label": "More options"},
                    ):
                        fragment.text("⋮")
                    with fragment.ul(
                        class_="dropdown-content menu shadow bg-base-100 rounded-box w-52",
                    ):
                        with fragment.li():
                            with fragment.a(
                                href=f"https://app.plain.com/search?q={self.org.email or self.org.slug}",
                                target="_blank",
                            ):
                                fragment.text("Search in Plain")
                        with fragment.li():
                            with fragment.a(
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:delete_dialog",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                fragment.text("Delete Organization")

        # Section tabs
        with fragment.div(class_="mb-6"):
            with self.section_tabs(request, section):
                pass

        # Two-column layout: main content + right sidebar
        with fragment.div(class_="flex gap-6"):
            # Main content (will be filled by section components)
            with self.main_content(request, section):
                yield fragment

            # Right sidebar
            with self.right_sidebar(request):
                pass


__all__ = ["OrganizationDetailView"]
