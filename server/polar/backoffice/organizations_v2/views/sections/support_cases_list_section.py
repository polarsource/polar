"""Organization 'Support Cases' tab: the org's support cases (appeals and
disputes), each linking to the shared case detail page."""

import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import tag, text

from polar.models import Organization

from ....components import card
from ....support_cases.queries import TYPE_LABELS, Row
from ....support_cases.urls import case_detail_url


class SupportCasesListSection:
    """List the organization's support cases with links to their detail page."""

    def __init__(self, organization: Organization, rows: Sequence[Row]) -> None:
        self.org = organization
        self.rows = rows

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        with tag.div(classes="space-y-6"):
            with card(bordered=True):
                with tag.h2(classes="text-lg font-semibold mb-4"):
                    text("Support Cases")
                if not self.rows:
                    with tag.p(classes="text-sm text-base-content/50"):
                        text("No support cases for this organization.")
                else:
                    self._render_table(request)
            yield

    def _render_table(self, request: Request) -> None:
        # Coming from the org page, the case detail's back link should return
        # here rather than to the global case list.
        return_to = (
            f"{request.url_for('organizations:detail', organization_id=self.org.id).path}"
            "?section=support_case"
        )
        with tag.div(classes="overflow-x-auto"):
            with tag.table(classes="table table-zebra"):
                with tag.thead():
                    with tag.tr():
                        for header in ("Type", "Status", "Assignee", "Opened"):
                            with tag.th():
                                text(header)
                with tag.tbody():
                    for (
                        case,
                        _organization,
                        is_open,
                        assignee_email,
                        awaiting_platform,
                    ) in self.rows:
                        case_url = case_detail_url(
                            request, case.id, return_to=return_to
                        )
                        with tag.tr(
                            classes="hover cursor-pointer",
                            _=f"on click set window.location to '{case_url}'",
                        ):
                            with tag.td():
                                with tag.a(href=case_url, classes="link"):
                                    text(TYPE_LABELS.get(case.type, case.type.value))
                            with tag.td():
                                with tag.div(classes="flex items-center gap-2"):
                                    variant = (
                                        "badge-success" if is_open else "badge-ghost"
                                    )
                                    with tag.div(classes=f"badge {variant} badge-sm"):
                                        text("Open" if is_open else "Closed")
                                    if awaiting_platform:
                                        with tag.span(
                                            classes="tooltip text-warning",
                                            data_tip="Awaiting reply",
                                        ):
                                            text("●")
                            with tag.td():
                                if assignee_email:
                                    text(assignee_email)
                                else:
                                    with tag.span(classes="text-base-content/40"):
                                        text("Unassigned")
                            with tag.td(classes="text-base-content/60"):
                                text(case.created_at.strftime("%b %-d, %Y %H:%M UTC"))


__all__ = ["SupportCasesListSection"]
