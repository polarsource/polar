"""Enhanced organization list view with tabs and quick actions."""

import contextlib
import json
import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Any, Literal

import pycountry
from fastapi import Request
from sqlalchemy import Select, func, select
from tagflow import tag, text

from polar.models import Organization, PayoutAccount
from polar.models.organization import (
    FIRST_REVIEW_MAX_THRESHOLD_CENTS,
    OrganizationStatus,
)
from polar.postgres import AsyncSession

from ... import formatters
from ...components import (
    Tab,
    action_bar,
    button,
    empty_state,
    status_badge,
    tab_nav,
)
from ..priority import Signals

FIRST_REVIEW_THRESHOLD_LABEL = formatters.currency(
    FIRST_REVIEW_MAX_THRESHOLD_CENTS, "usd"
)

DeletedFilter = Literal["exclude", "include", "only"]


def apply_deleted_filter[T: tuple[Any, ...]](
    stmt: Select[T], deleted: DeletedFilter
) -> Select[T]:
    if deleted == "only":
        return stmt.where(Organization.deleted_at.is_not(None))
    if deleted == "exclude":
        return stmt.where(Organization.deleted_at.is_(None))
    return stmt


class OrganizationListView:
    """Render the enhanced organization list view."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_status_counts(
        self, deleted: DeletedFilter = "exclude"
    ) -> dict[OrganizationStatus, int]:
        """Get count of organizations by status for tab badges."""
        stmt = select(
            Organization.status,
            func.count(Organization.id).label("count"),
        ).group_by(Organization.status)
        stmt = apply_deleted_filter(stmt, deleted)
        result = await self.session.execute(stmt)
        return {row.status: row.count for row in result}  # type: ignore[misc]

    async def get_distinct_countries(self) -> list[str]:
        """Get list of distinct countries from organizations with payout accounts."""
        stmt = (
            select(PayoutAccount.country)
            .join(Organization, Organization.payout_account_id == PayoutAccount.id)
            .distinct()
            .order_by(PayoutAccount.country)
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

        hx_vals = json.dumps(hx_vals_dict)

        with tag.th(
            classes=f"cursor-pointer hover:bg-base-300 {align_class}",
            **{
                "hx-get": str(request.url_for("organizations:list")),
                "hx-vals": hx_vals,
                "hx-target": "#org-list",
                "hx-include": "#filter-form",
                "hx-push-url": "true",
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

    def pagination_controls(
        self,
        request: Request,
        page: int,
        has_more: bool,
        current_sort: str,
        current_direction: str,
        status_filter: OrganizationStatus | None,
    ) -> None:
        """Render Previous/Next pagination buttons.

        Uses the limit+1 has_more detection so we never pay for a COUNT(*) just
        to render the page controls — works for tables of arbitrary size.
        """
        if page <= 1 and not has_more:
            return

        common_vals: dict[str, str | int] = {
            "sort": current_sort,
            "direction": current_direction,
        }
        if status_filter is not None:
            common_vals["status"] = status_filter.value

        def _nav_button(target_page: int, label: str, disabled: bool) -> None:
            if disabled:
                with tag.button(
                    type="button", classes="join-item btn btn-sm", disabled=True
                ):
                    text(label)
                return
            hx_vals = {**common_vals, "page": target_page}
            with tag.button(
                type="button",
                classes="join-item btn btn-sm",
                hx_get=str(request.url_for("organizations:list")),
                hx_vals=json.dumps(hx_vals),
                hx_include="#filter-form",
                hx_target="#org-list",
                hx_push_url="true",
            ):
                text(label)

        with tag.div(classes="flex justify-between items-center mt-6"):
            with tag.div(classes="text-sm text-base-content/60"):
                text(f"Page {page}")
            with tag.div(classes="join"):
                _nav_button(page - 1, "← Previous", disabled=page <= 1)
                _nav_button(page + 1, "Next →", disabled=not has_more)

    @contextlib.contextmanager
    def organization_row(
        self,
        request: Request,
        org: Organization,
        *,
        signals: Signals | None = None,
    ) -> Generator[None]:
        """Render a single organization row in the table.

        When ``signals`` is non-None the Review-tab Priority cell is rendered
        so the column count matches ``_render_org_list``'s Review-only header.
        """
        days_in_status = self.calculate_days_in_status(org)

        with tag.tr(classes="hover:bg-base-100"):
            # Organization name and status
            with tag.td(classes="py-4 max-w-xs"):
                with tag.div(classes="flex flex-col gap-1"):
                    with tag.a(
                        href=str(
                            request.url_for(
                                "organizations:detail", organization_id=org.id
                            )
                        ),
                        classes="font-semibold hover:underline flex items-center gap-2",
                    ):
                        with tag.span(
                            classes="truncate max-w-[200px] inline-block",
                            title=org.name,
                        ):
                            text(org.name)
                        if org.is_first_review:
                            with tag.span(
                                classes="badge badge-warning",
                                title=(
                                    "First review — never reviewed before "
                                    f"or next review threshold is ≤ "
                                    f"{FIRST_REVIEW_THRESHOLD_LABEL}"
                                ),
                                **{"aria-label": "first review status"},
                            ):
                                text("First Review")
                        else:
                            with status_badge(org.status):
                                pass
                    with tag.div(
                        classes="text-xs text-base-content/60 font-mono truncate max-w-[200px]",
                        title=org.slug,
                    ):
                        text(org.slug)
                    # Appeal indicator
                    if (
                        org.review
                        and org.review.appeal_submitted_at
                        and not org.review.appeal_reviewed_at
                    ):
                        with tag.span(classes="badge badge-info badge-xs mt-1"):
                            text("Appeal Pending")

            # Priority — Review tab only, sits next to Organization
            if signals is not None:
                tooltip = (
                    f"Aging {signals.aging_pts:.0f} + "
                    f"Risk {signals.risk_pts:.0f} + "
                    f"Payments {signals.payment_pts:.0f} + "
                    f"Fast Mover {signals.fast_mover_pts:.0f}"
                )
                with tag.td(classes="text-sm font-bold text-center"):
                    with tag.span(title=tooltip):
                        text(f"{signals.priority:.0f}")

            # Country
            with tag.td(classes="text-sm"):
                if org.payout_account:
                    text(org.payout_account.country)
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

            # Risk — hidden on Review tab (encoded in Priority breakdown)
            if signals is None:
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

            # Total balance
            with tag.td(classes="text-sm text-right"):
                if org.total_balance is not None:
                    text(f"${org.total_balance / 100:,.2f}")
                else:
                    with tag.span(classes="text-base-content/40"):
                        text("—")

            # Actions
            with tag.td(classes="text-right"):
                with tag.a(
                    href=str(
                        request.url_for("organizations:detail", organization_id=org.id)
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
        selected_first_reviews: str | None = None,
        selected_q: str | None = None,
        selected_risk_level: str | None = None,
        selected_days_in_status: str | None = None,
        selected_has_appeal: str | None = None,
        selected_deleted: DeletedFilter = "exclude",
        signals_by_org: dict[uuid.UUID, Signals] | None = None,
    ) -> Generator[None]:
        """Render the complete list view."""

        # Page header
        with tag.div(classes="flex items-center justify-between mb-8"):
            with tag.h1(classes="text-3xl font-bold"):
                text("Organizations")
            with action_bar(position="right"):
                with tag.a(
                    href=str(request.url_for("organizations-classic:list")),
                    classes="btn btn-ghost btn-sm",
                ):
                    text("Switch to Classic View")
                with button(
                    variant="primary",
                    hx_get=str(request.url_for("organizations:list")) + "/new",
                    hx_target="#modal",
                ):
                    text("+ Create Thread")

        # Status tabs
        tabs = [
            Tab(
                label="All",
                url=str(request.url_for("organizations:list")),
                active=status_filter is None,
                count=sum(status_counts.values()),
            ),
            Tab(
                label="Review",
                url=str(request.url_for("organizations:list")) + "?status=review",
                active=status_filter == OrganizationStatus.REVIEW,
                count=status_counts.get(OrganizationStatus.REVIEW, 0),
                badge_variant="warning",
            ),
            Tab(
                label="Snoozed",
                url=str(request.url_for("organizations:list")) + "?status=snoozed",
                active=status_filter == OrganizationStatus.SNOOZED,
                count=status_counts.get(OrganizationStatus.SNOOZED, 0),
                badge_variant="warning",
            ),
            Tab(
                label="Active",
                url=str(request.url_for("organizations:list")) + "?status=active",
                active=status_filter == OrganizationStatus.ACTIVE,
                count=status_counts.get(OrganizationStatus.ACTIVE, 0),
                badge_variant="success",
            ),
            Tab(
                label="Denied",
                url=str(request.url_for("organizations:list")) + "?status=denied",
                active=status_filter == OrganizationStatus.DENIED,
                count=status_counts.get(OrganizationStatus.DENIED, 0),
                badge_variant="error",
            ),
            Tab(
                label="Blocked",
                url=str(request.url_for("organizations:list")) + "?status=blocked",
                active=status_filter == OrganizationStatus.BLOCKED,
                count=status_counts.get(OrganizationStatus.BLOCKED, 0),
                badge_variant="error",
            ),
            Tab(
                label="Offboarding",
                url=str(request.url_for("organizations:list")) + "?status=offboarding",
                active=status_filter == OrganizationStatus.OFFBOARDING,
                count=status_counts.get(OrganizationStatus.OFFBOARDING, 0),
                badge_variant="warning",
            ),
        ]

        with tab_nav(tabs):
            pass

        # Search and filters section
        with tag.div(classes="my-6"):
            with tag.form(
                id="filter-form",
                classes="space-y-4",
                hx_get=str(request.url_for("organizations:list")),
                hx_trigger="submit, change from:.filter-select",
                hx_target="#org-list",
                hx_push_url="true",
            ):
                # Preserve the active status tab across filter submissions.
                # Without this, changing any filter drops the `status` query
                # param and the listing falls back to the default view.
                if status_filter is not None:
                    with tag.input(
                        type="hidden",
                        name="status",
                        value=status_filter.value,
                    ):
                        pass

                # Search bar with filter toggle
                with tag.div(classes="flex gap-3"):
                    # Search input
                    with tag.div(classes="flex-1"):
                        search_attrs: dict[str, str] = {
                            "type": "search",
                            "placeholder": ("Search organizations by name or slug..."),
                            "classes": "input input-bordered w-full",
                            "name": "q",
                            "hx-trigger": "keyup changed delay:300ms",
                        }
                        if selected_q:
                            search_attrs["value"] = selected_q
                        with tag.input(**search_attrs):
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
                                    for opt_value, opt_label in (
                                        ("", "All Risk Levels"),
                                        ("high", "High (≥75)"),
                                        ("medium", "Medium (50-74)"),
                                        ("low", "Low (<50)"),
                                        ("unscored", "Unscored"),
                                    ):
                                        opt_attrs: dict[str, str] = {"value": opt_value}
                                        if (selected_risk_level or "") == opt_value:
                                            opt_attrs["selected"] = ""
                                        with tag.option(**opt_attrs):
                                            text(opt_label)

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
                                    for opt_value, opt_label in (
                                        ("", "Any Duration"),
                                        ("1", ">1 day"),
                                        ("3", ">3 days"),
                                        ("7", ">7 days"),
                                        ("30", ">30 days"),
                                    ):
                                        opt_attrs = {"value": opt_value}
                                        if (selected_days_in_status or "") == opt_value:
                                            opt_attrs["selected"] = ""
                                        with tag.option(**opt_attrs):
                                            text(opt_label)

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
                                    for opt_value, opt_label in (
                                        ("", "All"),
                                        ("pending", "Pending Appeal"),
                                        ("reviewed", "Reviewed"),
                                        ("none", "No Appeal"),
                                    ):
                                        opt_attrs = {"value": opt_value}
                                        if (selected_has_appeal or "") == opt_value:
                                            opt_attrs["selected"] = ""
                                        with tag.option(**opt_attrs):
                                            text(opt_label)

                            # Deleted
                            with tag.div():
                                with tag.label(classes="label"):
                                    with tag.span(
                                        classes="label-text text-xs font-semibold"
                                    ):
                                        text("Deleted")
                                with tag.select(
                                    classes="select select-bordered select-sm w-full filter-select",
                                    name="deleted",
                                ):
                                    for opt_value, opt_label in (
                                        ("exclude", "Exclude Deleted"),
                                        ("include", "Include Deleted"),
                                        ("only", "Only Deleted"),
                                    ):
                                        opt_attrs = {"value": opt_value}
                                        if selected_deleted == opt_value:
                                            opt_attrs["selected"] = ""
                                        with tag.option(**opt_attrs):
                                            text(opt_label)

                            # Only meaningful on the Review tab
                            if status_filter == OrganizationStatus.REVIEW:
                                with tag.div():
                                    with tag.label(classes="label"):
                                        with tag.span(
                                            classes="label-text text-xs font-semibold"
                                        ):
                                            text("First Reviews")
                                    with tag.select(
                                        classes="select select-bordered select-sm w-full filter-select",
                                        name="first_reviews",
                                    ):
                                        with tag.option(value=""):
                                            text("All")
                                        first_review_attrs = {"value": "true"}
                                        if selected_first_reviews == "true":
                                            first_review_attrs["selected"] = ""
                                        with tag.option(**first_review_attrs):
                                            text("First Reviews")

        self._render_org_list(
            request,
            organizations,
            status_filter,
            page,
            has_more,
            current_sort,
            current_direction,
            signals_by_org,
        )

        yield

    def _render_org_list(
        self,
        request: Request,
        organizations: list[Organization],
        status_filter: OrganizationStatus | None,
        page: int,
        has_more: bool,
        current_sort: str,
        current_direction: str,
        signals_by_org: dict[uuid.UUID, Signals] | None = None,
    ) -> None:
        """Render the ``#org-list`` block — table with Review-only columns.

        Shared by ``render`` (full page) and ``render_table_only`` (HTMX
        partial swap), so both paths agree on column count.
        """
        signals_by_org = signals_by_org or {}
        is_review_tab = status_filter == OrganizationStatus.REVIEW

        with tag.div(id="org-list", classes="overflow-x-auto"):
            if not organizations:
                with empty_state(
                    "No Organizations Found",
                    "No organizations match your current filters.",
                ):
                    pass
            else:
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

                            # Priority sits next to Organization on the Review
                            # tab — primary sort, eye lands here second.
                            if is_review_tab:
                                with self.sortable_header(
                                    request,
                                    "Priority",
                                    "priority",
                                    current_sort,
                                    current_direction,
                                    "center",
                                    status_filter=status_filter,
                                ):
                                    pass

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

                            # Risk hidden on Review tab — it's already
                            # encoded in the Priority breakdown tooltip.
                            if not is_review_tab:
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
                                "Balance",
                                "total_balance",
                                current_sort,
                                current_direction,
                                "right",
                                status_filter=status_filter,
                            ):
                                pass

                            with tag.th(classes="text-right"):
                                text("Actions")

                    with tag.tbody():
                        for org in organizations:
                            with self.organization_row(
                                request,
                                org,
                                signals=signals_by_org.get(org.id),
                            ):
                                pass

                self.pagination_controls(
                    request,
                    page,
                    has_more,
                    current_sort,
                    current_direction,
                    status_filter,
                )

    @contextlib.contextmanager
    def render_table_only(
        self,
        request: Request,
        organizations: list[Organization],
        status_filter: OrganizationStatus | None,
        page: int,
        has_more: bool,
        current_sort: str = "priority",
        current_direction: str = "asc",
        *,
        signals_by_org: dict[uuid.UUID, Signals] | None = None,
    ) -> Generator[None]:
        """Render only the organization table (for HTMX updates)."""

        self._render_org_list(
            request,
            organizations,
            status_filter,
            page,
            has_more,
            current_sort,
            current_direction,
            signals_by_org,
        )

        yield


__all__ = ["OrganizationListView"]
