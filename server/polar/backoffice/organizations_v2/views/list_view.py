"""Enhanced organization list view with tabs, smart grouping, and quick actions."""

import contextlib
from collections.abc import Generator
from datetime import UTC, datetime

import pycountry
from fastapi import Request
from sqlalchemy import func, select
from tagflow import tag, text

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
    ) -> Generator[None]:
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

        with tag.th(
            classes=f"cursor-pointer hover:bg-base-300 {align_class}",
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

            with tag.div(classes=f"flex items-center gap-1 {justify}"):
                text(label)
                indicator_opacity = "opacity-100" if is_active else "opacity-50"
                with tag.span(classes=f"text-xs {indicator_opacity}"):
                    text(indicator)

        yield

    @contextlib.contextmanager
    def organization_row(
        self, request: Request, org: Organization, show_quick_actions: bool = False
    ) -> Generator[None]:
        """Render a single organization row in the table."""
        days_in_status = self.calculate_days_in_status(org)
        needs_attention = self.is_needs_attention(org)

        # Row classes based on status/attention
        row_class = "hover:bg-base-100"
        if needs_attention:
            row_class += " bg-error/5"

        with tag.tr(classes=row_class):
            # Organization name and status
            with tag.td(classes="py-4"):
                with tag.div(classes="flex flex-col gap-1"):
                    with tag.a(
                        href=str(
                            request.url_for(
                                "organizations-v2:detail", organization_id=org.id
                            )
                        ),
                        classes="font-semibold hover:underline flex items-center gap-2",
                    ):
                        text(org.name)
                        with status_badge(org.status):
                            pass
                    with tag.div(classes="text-xs text-base-content/60 font-mono"):
                        text(org.slug)
                    # Appeal indicator
                    if (
                        org.review
                        and org.review.appeal_submitted_at
                        and not org.review.appeal_reviewed_at
                    ):
                        with tag.span(classes="badge badge-info badge-xs mt-1"):
                            text("Appeal Pending")

            # Email
            with tag.td(classes="text-sm"):
                if org.email:
                    with tag.span(classes="font-mono text-xs"):
                        text(org.email)
                else:
                    with tag.span(classes="text-base-content/40"):
                        text("—")

            # Country
            with tag.td(classes="text-sm"):
                if org.account and org.account.country:
                    text(org.account.country)
                else:
                    with tag.span(classes="text-base-content/40"):
                        text("—")

            # Created
            with tag.td(classes="text-sm"):
                days_old = (datetime.now(UTC) - org.created_at).days
                text(f"{days_old}d ago")

            # Days in status
            with tag.td(classes="text-sm font-semibold text-center"):
                text(f"{days_in_status}d")

            # Risk score
            with tag.td(classes="text-sm text-center"):
                if org.review and org.review.risk_score is not None:
                    risk = org.review.risk_score
                    if risk >= 75:
                        color = "text-error"
                    elif risk >= 50:
                        color = "text-warning"
                    else:
                        color = "text-success"
                    with tag.span(classes=f"font-bold {color}"):
                        text(str(risk))
                else:
                    with tag.span(classes="text-base-content/40"):
                        text("—")

            # Next review
            with tag.td(classes="text-sm text-right"):
                if org.next_review_threshold:
                    text(f"${org.next_review_threshold / 100:,.0f}")
                else:
                    with tag.span(classes="text-base-content/40"):
                        text("—")

            # Actions
            with tag.td(classes="text-right"):
                if show_quick_actions:
                    with tag.div(classes="flex gap-2 justify-end"):
                        with button(
                            variant="secondary",
                            size="sm",
                            outline=True,
                            hx_post=str(
                                request.url_for(
                                    "organizations-v2:approve", organization_id=org.id
                                )
                            )
                            + "?threshold=25000",
                            hx_confirm="Approve with $250 threshold?",
                        ):
                            text("Approve")
                        with button(
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
                        ):
                            text("Deny")
                else:
                    with tag.a(
                        href=str(
                            request.url_for(
                                "organizations-v2:detail", organization_id=org.id
                            )
                        ),
                        classes="btn btn-ghost btn-sm",
                    ):
                        text("View →")

        yield

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

        # Page header
        with tag.div(classes="flex items-center justify-between mb-8"):
            with tag.h1(classes="text-3xl font-bold"):
                text("Organizations")
            with action_bar(position="right"):
                with button(
                    variant="primary",
                    hx_get=str(request.url_for("organizations-v2:list")) + "/new",
                    hx_target="#modal",
                ):
                    text("+ Create Thread")

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
        with tag.div(classes="my-6"):
            with tag.form(
                id="filter-form",
                classes="space-y-4",
                hx_get=str(request.url_for("organizations-v2:list")),
                hx_trigger="submit, change from:.filter-select",
                hx_target="#org-list",
            ):
                # Search bar with filter toggle
                with tag.div(classes="flex gap-3"):
                    # Search input
                    with tag.div(classes="flex-1"):
                        with tag.input(
                            type="search",
                            placeholder="Search organizations by name, slug, or email...",
                            classes="input input-bordered w-full",
                            name="q",
                            **{"hx-trigger": "keyup changed delay:300ms"},
                        ):
                            pass

                    # Advanced filters toggle button
                    with tag.button(
                        type="button",
                        id="filter-toggle-btn",
                        classes="btn btn-outline gap-2",
                        **{"_": "on click toggle .hidden on #advanced-filters"},
                    ):
                        with tag.svg(
                            xmlns="http://www.w3.org/2000/svg",
                            classes="h-5 w-5",
                            fill="none",
                            viewBox="0 0 24 24",
                            stroke="currentColor",
                        ):
                            with tag.path(
                                **{
                                    "stroke-linecap": "round",
                                    "stroke-linejoin": "round",
                                    "stroke-width": "2",
                                    "d": "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
                                }
                            ):
                                pass
                        text("Filters")

                    # Clear all button
                    with tag.button(
                        type="button",
                        id="clear-filters-btn",
                        classes="btn btn-ghost",
                        **{
                            "_": "on click set value of <input.filter-input/> to '' then set value of <select.filter-select/> to '' then trigger submit on #filter-form"
                        },
                    ):
                        text("Clear")

                # Advanced filters (hidden by default)
                with tag.div(
                    id="advanced-filters",
                    classes="hidden mt-4 p-4 bg-base-200 rounded-lg",
                ):
                    with tag.div(classes="space-y-3"):
                        # Row 1: Basic filters
                        with tag.div(classes="grid grid-cols-1 md:grid-cols-3 gap-3"):
                            # Country filter
                            with tag.div():
                                with tag.label(classes="label"):
                                    with tag.span(
                                        classes="label-text text-xs font-semibold"
                                    ):
                                        text("Country")
                                with tag.select(
                                    classes="select select-bordered select-sm w-full filter-select",
                                    name="country",
                                ):
                                    with tag.option(value=""):
                                        text("All Countries")
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
                                            with tag.option(**option_attrs):
                                                text(f"{country_code} - {display_name}")

                            # Risk filter
                            with tag.div():
                                with tag.label(classes="label"):
                                    with tag.span(
                                        classes="label-text text-xs font-semibold"
                                    ):
                                        text("Risk Level")
                                with tag.select(
                                    classes="select select-bordered select-sm w-full filter-select",
                                    name="risk_level",
                                ):
                                    with tag.option(value=""):
                                        text("All Risk Levels")
                                    with tag.option(value="high"):
                                        text("High (≥75)")
                                    with tag.option(value="medium"):
                                        text("Medium (50-74)")
                                    with tag.option(value="low"):
                                        text("Low (<50)")
                                    with tag.option(value="unscored"):
                                        text("Unscored")

                            # Days in status
                            with tag.div():
                                with tag.label(classes="label"):
                                    with tag.span(
                                        classes="label-text text-xs font-semibold"
                                    ):
                                        text("Days in Status")
                                with tag.select(
                                    classes="select select-bordered select-sm w-full filter-select",
                                    name="days_in_status",
                                ):
                                    with tag.option(value=""):
                                        text("Any Duration")
                                    with tag.option(value="1"):
                                        text(">1 day")
                                    with tag.option(value="3"):
                                        text(">3 days")
                                    with tag.option(value="7"):
                                        text(">7 days")
                                    with tag.option(value="30"):
                                        text(">30 days")

                        # Row 2: Appeal filter
                        with tag.div(classes="grid grid-cols-1 md:grid-cols-3 gap-3"):
                            # Has appeal
                            with tag.div():
                                with tag.label(classes="label"):
                                    with tag.span(
                                        classes="label-text text-xs font-semibold"
                                    ):
                                        text("Appeal Status")
                                with tag.select(
                                    classes="select select-bordered select-sm w-full filter-select",
                                    name="has_appeal",
                                ):
                                    with tag.option(value=""):
                                        text("All")
                                    with tag.option(value="pending"):
                                        text("Pending Appeal")
                                    with tag.option(value="reviewed"):
                                        text("Reviewed")
                                    with tag.option(value="none"):
                                        text("No Appeal")

        # Organization table
        with tag.div(id="org-list", classes="overflow-x-auto"):
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
                    with tag.div(classes="mb-8"):
                        with tag.h2(
                            classes="text-xl font-bold mb-4 flex items-center gap-3"
                        ):
                            text("Needs Attention")
                            with tag.span(classes="badge badge-error badge-lg"):
                                text(str(len(needs_attention)))

                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with self.sortable_header(
                                        request,
                                        "Organization",
                                        "name",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with tag.th():
                                        text("Email")

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

                                    with tag.th(classes="text-right"):
                                        text("Actions")

                            with tag.tbody():
                                for org in needs_attention:
                                    with self.organization_row(
                                        request, org, show_quick_actions=True
                                    ):
                                        pass

                    # Divider
                    with tag.div(classes="divider my-8"):
                        text("All Organizations")

                # Regular organizations table
                if regular_orgs or status_filter is not None:
                    with tag.table(classes="table table-zebra w-full"):
                        with tag.thead():
                            with tag.tr():
                                with self.sortable_header(
                                    request,
                                    "Organization",
                                    "name",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with tag.th():
                                    text("Email")

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

                                with tag.th(classes="text-right"):
                                    text("Actions")

                        with tag.tbody():
                            display_orgs = (
                                regular_orgs if status_filter is None else organizations
                            )
                            for org in display_orgs:
                                with self.organization_row(request, org):
                                    pass

                # Pagination
                if has_more:
                    with tag.div(classes="flex justify-center mt-6"):
                        with button(
                            variant="secondary",
                            hx_get=str(request.url_for("organizations-v2:list"))
                            + f"?page={page + 1}",
                            hx_target="#org-list",
                            hx_swap="beforeend",
                        ):
                            text("Load More")

        yield

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

        # Organization table
        with tag.div(id="org-list", classes="overflow-x-auto"):
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
                    with tag.div(classes="mb-8"):
                        with tag.h2(
                            classes="text-xl font-bold mb-4 flex items-center gap-3"
                        ):
                            text("Needs Attention")
                            with tag.span(classes="badge badge-error badge-lg"):
                                text(str(len(needs_attention)))

                        with tag.table(classes="table table-zebra w-full"):
                            with tag.thead():
                                with tag.tr():
                                    with self.sortable_header(
                                        request,
                                        "Organization",
                                        "name",
                                        current_sort,
                                        current_direction,
                                        status_filter=status_filter,
                                    ):
                                        pass

                                    with tag.th():
                                        text("Email")

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

                                    with tag.th(classes="text-right"):
                                        text("Actions")

                            with tag.tbody():
                                for org in needs_attention:
                                    with self.organization_row(
                                        request, org, show_quick_actions=True
                                    ):
                                        pass

                    # Divider
                    with tag.div(classes="divider my-8"):
                        text("All Organizations")

                # Regular organizations table
                if regular_orgs or status_filter is not None:
                    with tag.table(classes="table table-zebra w-full"):
                        with tag.thead():
                            with tag.tr():
                                with self.sortable_header(
                                    request,
                                    "Organization",
                                    "name",
                                    current_sort,
                                    current_direction,
                                    status_filter=status_filter,
                                ):
                                    pass

                                with tag.th():
                                    text("Email")

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

                                with tag.th(classes="text-right"):
                                    text("Actions")

                        with tag.tbody():
                            display_orgs = (
                                regular_orgs if status_filter is None else organizations
                            )
                            for org in display_orgs:
                                with self.organization_row(request, org):
                                    pass

                # Pagination
                if has_more:
                    with tag.div(classes="flex justify-center mt-6"):
                        with button(
                            variant="secondary",
                            hx_get=str(request.url_for("organizations-v2:list"))
                            + f"?page={page + 1}",
                            hx_target="#org-list",
                            hx_swap="beforeend",
                        ):
                            text("Load More")

        yield


__all__ = ["OrganizationListView"]
