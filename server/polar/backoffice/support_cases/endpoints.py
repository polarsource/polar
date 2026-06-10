from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4
from sqlalchemy import func, select
from tagflow import tag, text

from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import ReviewAppealSupportCase
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseRepository,
)
from polar.support_case.service import support_case as support_case_service

from ..components import datatable
from ..components._tab_nav import Tab, tab_nav
from ..dependencies import get_admin
from ..layout import layout
from ..responses import HXRedirectResponse

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


def _safe_return_to(request: Request, return_to: str | None) -> str:
    """Same-site relative path only, to avoid an open redirect."""
    if return_to and return_to.startswith("/") and not return_to.startswith("//"):
        return return_to
    return str(request.url_for("support_cases:list"))


@router.post("/{case_id}/take", name="support_cases:take", response_model=None)
async def take_case(
    request: Request,
    case_id: UUID4,
    return_to: Annotated[str | None, Query()] = None,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> HXRedirectResponse:
    """Assign a case to the acting staff member (advisory; any case type)."""
    case = await SupportCaseRepository.from_session(session).get_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Support case not found")
    await support_case_service.assign(session, case, assignee=user_session.user)
    return HXRedirectResponse(request, _safe_return_to(request, return_to), 303)


@router.post("/{case_id}/release", name="support_cases:release", response_model=None)
async def release_case(
    request: Request,
    case_id: UUID4,
    return_to: Annotated[str | None, Query()] = None,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> HXRedirectResponse:
    """Clear a case's assignee."""
    case = await SupportCaseRepository.from_session(session).get_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Support case not found")
    await support_case_service.unassign(session, case, actor=user_session.user)
    return HXRedirectResponse(request, _safe_return_to(request, return_to), 303)


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
