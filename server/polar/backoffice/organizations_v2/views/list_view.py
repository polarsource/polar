"""Enhanced organization list view with tabs, smart grouping, and quick actions."""

import contextlib
from collections.abc import Generator
from datetime import UTC, datetime

import pycountry
from fastapi import Request
from markupflow import Fragment
from sqlalchemy import func, select

from polar.models import Account, Organization
from polar.models.organization import OrganizationStatus
from polar.postgres import AsyncSession

from ...components import (
    Tab,
    action_bar,
    button,
    empty_state,
    status_badge,
    tab_nav,
)


class OrganizationListView:
    """Render the enhanced organization list view."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_status_counts(self) -> dict[OrganizationStatus, int]:
        """Get count of organizations by status for tab badges."""
        stmt = select(
            Organization.status,
            func.count(Organization.id).label("count"),
        ).group_by(Organization.status)
        result = await self.session.execute(stmt)
        return {row.status: row.count for row in result}  # type: ignore[misc]

    async def get_distinct_countries(self) -> list[str]:
        """Get list of distinct countries from organizations with accounts."""
        stmt = (
            select(Account.country)
            .join(Organization, Organization.account_id == Account.id)
            .where(Account.country.is_not(None))
            .distinct()
            .order_by(Account.country)
        )
        result = await self.session.execute(stmt)
        return [row[0] for row in result.all()]

    def calculate_days_in_status(self, org: Organization) -> int:
        """Calculate how many days organization has been in current status."""
        if not org.status_updated_at:
            delta = datetime.now(UTC) - org.created_at
        else:
            delta = datetime.now(UTC) - org.status_updated_at
        return delta.days

    def is_needs_attention(self, org: Organization) -> bool:
        """Determine if organization needs immediate attention."""
        days_in_status = self.calculate_days_in_status(org)

        # Under review for more than 3 days
        if org.is_under_review and days_in_status > 3:
            return True

        # Has pending appeal
        if (
            org.review
            and org.review.appeal_submitted_at
            and not org.review.appeal_reviewed_at
        ):
            return True

        # High risk score
        if org.review and org.review.risk_score and org.review.risk_score >= 80:
            return True

        return False

    @contextlib.contextmanager
    def sortable_header(
        self,
        request: Request,
        label: str,
        sort_key: str,
        current_sort: str,
        current_direction: str,
        align: str = "left",
        status_filter: OrganizationStatus | None = None,
    ) -> Generator[Fragment]:
        """Render a sortable table header with direction indicator."""
        is_active = current_sort == sort_key
        # Toggle direction: if currently ASC, next click is DESC
        next_direction = "desc" if (is_active and current_direction == "asc") else "asc"

        # Determine indicator
        if is_active:
            indicator = "↑" if current_direction == "asc" else "↓"
        else:
            indicator = "↕"

        align_class = {
            "left": "",
            "center": "text-center",
            "right": "text-right",
        }.get(align, "")

        # Build hx-vals with status filter if present
        hx_vals_dict = {"sort": sort_key, "direction": next_direction}
        if status_filter is not None:
            hx_vals_dict["status"] = status_filter.value

        import json

        hx_vals = json.dumps(hx_vals_dict)

        fragment = Fragment()
        with fragment.th(
            class_=f"cursor-pointer hover:bg-base-300 {align_class}",
            **{
                "hx-get": str(request.url_for("organizations-v2:list")),
                "hx-vals": hx_vals,
                "hx-target": "#org-list",
                "hx-include": "#filter-form",
            },
        ):
            justify = {
                "left": "justify-start",
                "center": "justify-center",
                "right": "justify-end",
            }.get(align, "justify-start")

            with fragment.div(class_=f"flex items-center gap-1 {justify}"):
                fragment.text(label)
                indicator_opacity = "opacity-100" if is_active else "opacity-50"
                with fragment.span(class_=f"text-xs {indicator_opacity}"):
                    fragment.text(indicator)

        yield fragment

    @contextlib.contextmanager
    def organization_row(
        self, request: Request, org: Organization, show_quick_actions: bool = False
    ) -> Generator[Fragment]:
        """Render a single organization row in the table."""
        days_in_status = self.calculate_days_in_status(org)
        needs_attention = self.is_needs_attention(org)

        # Row classes based on status/attention
        row_class = "hover:bg-base-100"
        if needs_attention:
            row_class += " bg-error/5"

        fragment = Fragment()
        with fragment.tr(class_=row_class):
            # Organization name and status
            with fragment.td(class_="py-4"):
                with fragment.div(class_="flex flex-col gap-1"):
                    with fragment.a(
                        href=str(
                            request.url_for(
                                "organizations-v2:detail", organization_id=org.id
                            )
                        ),
                        class_="font-semibold hover:underline flex items-center gap-2",
                    ):
                        fragment.text(org.name)
                        with status_badge(org.status):
                            pass
                    with fragment.div(class_="text-xs text-base-content/60 font-mono"):
                        fragment.text(org.slug)
                    # Appeal indicator
                    if (
                        org.review
                        and org.review.appeal_submitted_at
                        and not org.review.appeal_reviewed_at
                    ):
                        with fragment.span(class_="badge badge-info badge-xs mt-1"):
                            fragment.text("Appeal Pending")

            # Email
            with fragment.td(class_="text-sm"):
                if org.email:
                    with fragment.span(class_="font-mono text-xs"):
                        fragment.text(org.email)
                else:
                    with fragment.span(class_="text-base-content/40"):
                        fragment.text("—")

            # Country
            with fragment.td(class_="text-sm"):
                if org.account and org.account.country:
                    fragment.text(org.account.country)
                else:
                    with fragment.span(class_="text-base-content/40"):
                        fragment.text("—")

            # Created
            with fragment.td(class_="text-sm"):
                days_old = (datetime.now(UTC) - org.created_at).days
                fragment.text(f"{days_old}d ago")

            # Days in status
            with fragment.td(class_="text-sm font-semibold text-center"):
                fragment.text(f"{days_in_status}d")

            # Risk score
            with fragment.td(class_="text-sm text-center"):
                if org.review and org.review.risk_score is not None:
                    risk = org.review.risk_score
                    if risk >= 75:
                        color = "text-error"
                    elif risk >= 50:
                        color = "text-warning"
                    else:
                        color = "text-success"
                    with fragment.span(class_=f"font-bold {color}"):
                        fragment.text(str(risk))
                else:
                    with fragment.span(class_="text-base-content/40"):
                        fragment.text("—")

            # Next review
            with fragment.td(class_="text-sm text-right"):
                if org.next_review_threshold:
                    fragment.text(f"${org.next_review_threshold / 100:,.0f}")
                else:
                    with fragment.span(class_="text-base-content/40"):
                        fragment.text("—")

            # Actions
            with fragment.td(class_="text-right"):
                if show_quick_actions:
                    with fragment.div(class_="flex gap-2 justify-end"):
                        with fragment.fragment(
                            button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_post=str(
                                    request.url_for(
                                        "organizations-v2:approve",
                                        organization_id=org.id,
                                    )
                                )
                                + "?threshold=25000",
                                hx_confirm="Approve with $250 threshold?",
                            )
                        ):
                            fragment.text("Approve")
                        with fragment.fragment(
                            button(
                                variant="secondary",
                                size="sm",
                                outline=True,
                                hx_get=str(
                                    request.url_for(
                                        "organizations-v2:deny_dialog",
                                        organization_id=org.id,
                                    )
                                ),
                                hx_target="#modal",
                            )
                        ):
                            fragment.text("Deny")
                else:
                    with fragment.a(
                        href=str(
                            request.url_for(
                                "organizations-v2:detail", organization_id=org.id
                            )
                        ),
                        class_="btn btn-ghost btn-sm",
                    ):
                        fragment.text("View →")

        yield fragment

    @contextlib.contextmanager
    def render(
        self,
        request: Request,
        organizations: list[Organization],
        status_filter: OrganizationStatus | None,
        status_counts: dict[OrganizationStatus, int],
        page: int,
        has_more: bool,
        current_sort: str = "priority",
        current_direction: str = "asc",
        countries: list[str] | None = None,
        selected_country: str | None = None,
    ) -> Generator[None]:
        """Render the complete list view."""

        fragment = Fragment()

        # Page header
        with fragment.div(class_="flex items-center justify-between mb-8"):
            with fragment.h1(class_="text-3xl font-bold"):
                fragment.text("Organizations")
            with action_bar(position="right"):
                with fragment.fragment(
                    button(
                        variant="primary",
                        hx_get=str(request.url_for("organizations-v2:list")) + "/new",
                        hx_target="#modal",
                    )
                ):
                    fragment.text("+ Create Thread")

        # Status tabs
        tabs = [
            Tab(
                label="All",
                url=str(request.url_for("organizations-v2:list")),
                active=status_filter is None,
                count=sum(status_counts.values()),
            ),
            Tab(
                label="Initial Review",
                url=str(request.url_for("organizations-v2:list"))
                + "?status=initial_review",
                active=status_filter == OrganizationStatus.INITIAL_REVIEW,
                count=status_counts.get(OrganizationStatus.INITIAL_REVIEW, 0),
                badge_variant="warning",
            ),
            Tab(
                label="Ongoing Review",
                url=str(request.url_for("organizations-v2:list"))
                + "?status=ongoing_review",
                active=status_filter == OrganizationStatus.ONGOING_REVIEW,
                count=status_counts.get(OrganizationStatus.ONGOING_REVIEW, 0),
                badge_variant="warning",
            ),
            Tab(
                label="Active",
                url=str(request.url_for("organizations-v2:list")) + "?status=active",
                active=status_filter == OrganizationStatus.ACTIVE,
                count=status_counts.get(OrganizationStatus.ACTIVE, 0),
                badge_variant="success",
            ),
            Tab(
                label="Denied",
                url=str(request.url_for("organizations-v2:list")) + "?status=denied",
                active=status_filter == OrganizationStatus.DENIED,
                count=status_counts.get(OrganizationStatus.DENIED, 0),
                badge_variant="error",
            ),
        ]

        with tab_nav(tabs):
            pass

        # Search and filters section
        with fragment.div(class_="my-6"):
            with fragment.form(
                id="filter-form",
                class_="space-y-4",
                hx_get=str(request.url_for("organizations-v2:list")),
                hx_trigger="submit, change from:.filter-select",
                hx_target="#org-list",
            ):
                # Search bar with filter toggle
                with fragment.div(class_="flex gap-3"):
                    # Search input
                    with fragment.div(class_="flex-1"):
                        with fragment.input(
                            type="search",
                            placeholder="Search organizations by name, slug, or email...",
                            class_="input input-bordered w-full",
                            name="q",
                            **{"hx-trigger": "keyup changed delay:300ms"},
                        ):
                            pass

                    # Advanced filters toggle button
                    with fragment.button(
                        type="button",
                        id="filter-toggle-btn",
                        class_="btn btn-outline gap-2",
                        **{"_": "on click toggle .hidden on #advanced-filters"},
                    ):
                        with fragment.svg(
                            xmlns="http://www.w3.org/2000/svg",
                            class_="h-5 w-5",
                            fill="none",
                            viewBox="0 0 24 24",
                            stroke="currentColor",
                        ):
                            with fragment.path(
                                **{
                                    "stroke-linecap": "round",
                                    "stroke-linejoin": "round",
                                    "stroke-width": "2",
                                    "d": "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
                                }
                            ):
                                pass
                        fragment.text("Filters")

                    # Clear all button
                    with fragment.button(
                        type="button",
                        id="clear-filters-btn",
                        class_="btn btn-ghost",
                        **{
                            "_": "on click set value of <input.filter-input/> to '' then set value of <select.filter-select/> to '' then trigger submit on #filter-form"
                        },
                    ):
                        fragment.text("Clear")

                # Advanced filters (hidden by default)
                with fragment.div(
                    id="advanced-filters",
                    class_="hidden mt-4 p-4 bg-base-200 rounded-lg",
                ):
                    with fragment.div(class_="space-y-3"):
                        # Row 1: Basic filters
                        with fragment.div(
                            class_="grid grid-cols-1 md:grid-cols-3 gap-3"
                        ):
                            # Country filter
                            with fragment.div():
                                with fragment.label(class_="label"):
                                    with fragment.span(
                                        class_="label-text text-xs font-semibold"
                                    ):
                                        fragment.text("Country")
                                with fragment.select(
                                    class_="select select-bordered select-sm w-full filter-select",
                                    name="country",
                                ):
                                    with fragment.option(value=""):
                                        fragment.text("All Countries")
                                    if countries:
                                        for country_code in countries:
                                            country = pycountry.countries.get(
                                                alpha_2=country_code
                                            )
                                            display_name = (
                                                country.name
                                                if country
                                                else country_code
                                            )
                                            option_attrs = {"value": country_code}
                                            if selected_country == country_code:
                                                option_attrs["selected"] = ""
                                            with fragment.option(**option_attrs):
                                                fragment.text(
                                                    f"{country_code} - {display_name}"
                                                )

                            # Risk filter
                            with fragment.div():
                                with fragment.label(class_="label"):
                                    with fragment.span(
                                        class_="label-text text-xs font-semibold"
                                    ):
                                        fragment.text("Risk Level")
                                with fragment.select(
                                    class_="select select-bordered select-sm w-full filter-select",
                                    name="risk_level",
                                ):
                                    with fragment.option(value=""):
                                        fragment.text("All Risk Levels")
                                    with fragment.option(value="high"):
                                        fragment.text("High (≥75)")
                                    with fragment.option(value="medium"):
                                        fragment.text("Medium (50-74)")
                                    with fragment.option(value="low"):
                                        fragment.text("Low (<50)")
                                    with fragment.option(value="unscored"):
                                        fragment.text("Unscored")

                            # Days in status
                            with fragment.div():
                                with fragment.label(class_="label"):
                                    with fragment.span(
                                        class_="label-text text-xs font-semibold"
                                    ):
                                        fragment.text("Days in Status")
                                with fragment.select(
                                    class_="select select-bordered select-sm w-full filter-select",
                                    name="days_in_status",
                                ):
                                    with fragment.option(value=""):
                                        fragment.text("Any Duration")
                                    with fragment.option(value="1"):
                                        fragment.text(">1 day")
                                    with fragment.option(value="3"):
                                        fragment.text(">3 days")
                                    with fragment.option(value="7"):
                                        fragment.text(">7 days")
                                    with fragment.option(value="30"):
                                        fragment.text(">30 days")

                        # Row 2: Appeal filter
                        with fragment.div(
                            class_="grid grid-cols-1 md:grid-cols-3 gap-3"
                        ):
                            # Has appeal
                            with fragment.div():
                                with fragment.label(class_="label"):
                                    with fragment.span(
                                        class_="label-text text-xs font-semibold"
                                    ):
                                        fragment.text("Appeal Status")
                                with fragment.select(
                                    class_="select select-bordered select-sm w-full filter-select",
                                    name="has_appeal",
                                ):
                                    with fragment.option(value=""):
                                        fragment.text("All")
                                    with fragment.option(value="pending"):
                                        fragment.text("Pending Appeal")
                                    with fragment.option(value="reviewed"):
                                        fragment.text("Reviewed")
                                    with fragment.option(value="none"):
                                        fragment.text("No Appeal")

        # Organization table
        with fragment.div(id="org-list", class_="overflow-x-auto"):
            if not organizations:
                with empty_state(
                    "No Organizations Found",
                    "No organizations match your current filters.",
                ):
                    pass
            else:
                # Separate needs attention from regular
                needs_attention = [
                    org for org in organizations if self.is_needs_attention(org)
                ]
                regular_orgs = [
                    org for org in organizations if not self.is_needs_attention(org)
                ]

                # Needs attention table
                if needs_attention and status_filter is None:
                    with fragment.div(class_="mb-8"):
                        with fragment.h2(
                            class_="text-xl font-bold mb-4 flex items-center gap-3"
                        ):
                            fragment.text("Needs Attention")
                            with fragment.span(class_="badge badge-error badge-lg"):
                                fragment.text(str(len(needs_attention)))

                        with fragment.table(class_="table table-zebra w-full"):
                            with fragment.thead():
                                with fragment.tr():
                                    with self.sortable_header(
                                        request,
                                        "Organization",
                                        "name",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with fragment.th():
                                        fragment.text("Email")

                                    with self.sortable_header(
                                        request,
                                        "Country",
                                        "country",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Created",
                                        "created",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "In Status",
                                        "status_duration",
                                        current_sort,
                                        current_direction,
                                        "center",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Risk",
                                        "risk",
                                        current_sort,
                                        current_direction,
                                        "center",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Next Review",
                                        "next_review",
                                        current_sort,
                                        current_direction,
                                        "right",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with fragment.th(class_="text-right"):
                                        fragment.text("Actions")

                            with fragment.tbody():
                                for org in needs_attention:
                                    with self.organization_row(
                                        request, org, show_quick_actions=True
                                    ):
                                        pass

                    # Divider
                    with fragment.div(class_="divider my-8"):
                        fragment.text("All Organizations")

                # Regular organizations table
                if regular_orgs or status_filter is not None:
                    with fragment.table(class_="table table-zebra w-full"):
                        with fragment.thead():
                            with fragment.tr():
                                with self.sortable_header(
                                    request,
                                    "Organization",
                                    "name",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with fragment.th():
                                    fragment.text("Email")

                                with self.sortable_header(
                                    request,
                                    "Country",
                                    "country",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Created",
                                    "created",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "In Status",
                                    "status_duration",
                                    current_sort,
                                    current_direction,
                                    "center",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Risk",
                                    "risk",
                                    current_sort,
                                    current_direction,
                                    "center",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Next Review",
                                    "next_review",
                                    current_sort,
                                    current_direction,
                                    "right",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with fragment.th(class_="text-right"):
                                    fragment.text("Actions")

                        with fragment.tbody():
                            display_orgs = (
                                regular_orgs if status_filter is None else organizations
                            )
                            for org in display_orgs:
                                with self.organization_row(request, org):
                                    pass

                # Pagination
                if has_more:
                    with fragment.div(class_="flex justify-center mt-6"):
                        with fragment.fragment(
                            button(
                                variant="secondary",
                                hx_get=str(request.url_for("organizations-v2:list"))
                                + f"?page={page + 1}",
                                hx_target="#org-list",
                                hx_swap="beforeend",
                            )
                        ):
                            fragment.text("Load More")

        yield fragment

    @contextlib.contextmanager
    def render_table_only(
        self,
        request: Request,
        organizations: list[Organization],
        status_filter: OrganizationStatus | None,
        status_counts: dict[OrganizationStatus, int],
        page: int,
        has_more: bool,
        current_sort: str = "priority",
        current_direction: str = "asc",
    ) -> Generator[None]:
        """Render only the organization table (for HTMX updates)."""

        fragment = Fragment()

        # Organization table
        with fragment.div(id="org-list", class_="overflow-x-auto"):
            if not organizations:
                with empty_state(
                    "No Organizations Found",
                    "No organizations match your current filters.",
                ):
                    pass
            else:
                # Separate needs attention from regular
                needs_attention = [
                    org for org in organizations if self.is_needs_attention(org)
                ]
                regular_orgs = [
                    org for org in organizations if not self.is_needs_attention(org)
                ]

                # Needs attention table
                if needs_attention and status_filter is None:
                    with fragment.div(class_="mb-8"):
                        with fragment.h2(
                            class_="text-xl font-bold mb-4 flex items-center gap-3"
                        ):
                            fragment.text("Needs Attention")
                            with fragment.span(class_="badge badge-error badge-lg"):
                                fragment.text(str(len(needs_attention)))

                        with fragment.table(class_="table table-zebra w-full"):
                            with fragment.thead():
                                with fragment.tr():
                                    with self.sortable_header(
                                        request,
                                        "Organization",
                                        "name",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with fragment.th():
                                        fragment.text("Email")

                                    with self.sortable_header(
                                        request,
                                        "Country",
                                        "country",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Created",
                                        "created",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "In Status",
                                        "status_duration",
                                        current_sort,
                                        current_direction,
                                        "center",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Risk",
                                        "risk",
                                        current_sort,
                                        current_direction,
                                        "center",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with self.sortable_header(
                                        request,
                                        "Next Review",
                                        "next_review",
                                        current_sort,
                                        current_direction,
                                        "right",
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with fragment.th(class_="text-right"):
                                        fragment.text("Actions")

                            with fragment.tbody():
                                for org in needs_attention:
                                    with self.organization_row(
                                        request, org, show_quick_actions=True
                                    ):
                                        pass

                    # Divider
                    with fragment.div(class_="divider my-8"):
                        fragment.text("All Organizations")

                # Regular organizations table
                if regular_orgs or status_filter is not None:
                    with fragment.table(class_="table table-zebra w-full"):
                        with fragment.thead():
                            with fragment.tr():
                                with self.sortable_header(
                                    request,
                                    "Organization",
                                    "name",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with fragment.th():
                                    fragment.text("Email")

                                with self.sortable_header(
                                    request,
                                    "Country",
                                    "country",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Created",
                                    "created",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "In Status",
                                    "status_duration",
                                    current_sort,
                                    current_direction,
                                    "center",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Risk",
                                    "risk",
                                    current_sort,
                                    current_direction,
                                    "center",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with self.sortable_header(
                                    request,
                                    "Next Review",
                                    "next_review",
                                    current_sort,
                                    current_direction,
                                    "right",
                                    status_filter=status_filter,
                                ):
                                    pass

                                with fragment.th(class_="text-right"):
                                    fragment.text("Actions")

                        with fragment.tbody():
                            display_orgs = (
                                regular_orgs if status_filter is None else organizations
                            )
                            for org in display_orgs:
                                with self.organization_row(request, org):
                                    pass

                # Pagination
                if has_more:
                    with fragment.div(class_="flex justify-center mt-6"):
                        with fragment.fragment(
                            button(
                                variant="secondary",
                                hx_get=str(request.url_for("organizations-v2:list"))
                                + f"?page={page + 1}",
                                hx_target="#org-list",
                                hx_swap="beforeend",
                            )
                        ):
                            fragment.text("Load More")

        yield fragment


__all__ = ["OrganizationListView"]
