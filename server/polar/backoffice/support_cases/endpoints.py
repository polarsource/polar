from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import ReviewAppealSupportCase
from polar.postgres import AsyncSession, get_db_read_session
from polar.support_case.repository import SupportCaseMessageRepository

from ..components import datatable
from ..components._tab_nav import Tab, tab_nav
from ..layout import layout

router = APIRouter()

# (case, organization, is_open)
Row = tuple[ReviewAppealSupportCase, Organization, bool]


def _list_tabs(request: Request, active: str) -> list[Tab]:
    base = str(request.url_for("support_cases:list"))
    return [
        Tab("Open", url=f"{base}?status=open", active=active == "open"),
        Tab("Closed", url=f"{base}?status=closed", active=active == "closed"),
        Tab("All", url=f"{base}?status=all", active=active == "all"),
    ]


def _status_badge(is_open: bool) -> None:
    variant = "badge-success" if is_open else "badge-ghost"
    with tag.div(classes=f"badge {variant} badge-sm"):
        text("Open" if is_open else "Closed")


def _render_table(rows: Sequence[Row]) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra"):
            with tag.thead():
                with tag.tr():
                    for header in ("Organization", "Type", "Status", "Opened"):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for case, organization, is_open in rows:
                    # Not linked yet: the org's support-case section these rows
                    # point to ships in a follow-up PR.
                    with tag.tr():
                        with tag.td():
                            text(organization.name)
                        with tag.td():
                            with tag.div(classes="badge badge-outline badge-sm"):
                                text("Review appeal")
                        with tag.td():
                            _status_badge(is_open)
                        with tag.td(classes="text-base-content/60"):
                            text(case.created_at.strftime("%b %-d, %Y %H:%M UTC"))


@router.get("/", name="support_cases:list")
async def list_cases(
    request: Request,
    pagination: PaginationParamsQuery,
    status: Annotated[str, Query()] = "open",
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    is_open = SupportCaseMessageRepository.is_open_expression()
    statement = (
        select(ReviewAppealSupportCase, Organization, is_open.label("is_open"))
        .join(
            OrganizationReview,
            ReviewAppealSupportCase.organization_review_id == OrganizationReview.id,
        )
        .join(Organization, OrganizationReview.organization_id == Organization.id)
        .where(ReviewAppealSupportCase.deleted_at.is_(None))
    )
    count_statement = (
        select(func.count())
        .select_from(ReviewAppealSupportCase)
        .where(ReviewAppealSupportCase.deleted_at.is_(None))
    )
    if status == "open":
        statement = statement.where(is_open)
        count_statement = count_statement.where(is_open)
    elif status == "closed":
        statement = statement.where(~is_open)
        count_statement = count_statement.where(~is_open)

    count = await session.scalar(count_statement) or 0
    result = await session.execute(
        statement.order_by(ReviewAppealSupportCase.created_at.desc())
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit)
    )
    rows: Sequence[Row] = result.all()  # type: ignore[assignment]

    with layout(
        request,
        [("Cases", str(request.url_for("support_cases:list")))],
        "support_cases:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Cases")
            with tab_nav(_list_tabs(request, status)):
                pass
            if rows:
                _render_table(rows)
            else:
                with tag.div(classes="text-center py-12 text-base-content/50"):
                    text("No cases in this view.")
            with datatable.pagination(request, pagination, count):
                pass
