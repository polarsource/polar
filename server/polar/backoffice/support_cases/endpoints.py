from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import UUID4
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.file.service import file as file_service
from polar.kit.pagination import PaginationParamsQuery
from polar.models import Organization, User
from polar.models.organization_review import OrganizationReview
from polar.models.support_case import ReviewAppealSupportCase, SupportCaseAttachment
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.support_case.repository import (
    SupportCaseAttachmentRepository,
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

# (case, organization, is_open, assignee_email)
Row = tuple[ReviewAppealSupportCase, Organization, bool, str | None, bool]


def _list_tabs(request: Request, status: str, assigned: str) -> list[Tab]:
    base = str(request.url_for("support_cases:list"))

    def url(status: str, assigned: str) -> str:
        return f"{base}?status={status}&assigned={assigned}"

    # Status (left) filters preserve the current assignment. The assignment
    # filters (right, pushed via ml-auto) toggle: clicking the active one
    # clears back to everyone, so no redundant "all assignees" tab is needed.
    return [
        Tab("Open", url=url("open", assigned), active=status == "open"),
        Tab("Closed", url=url("closed", assigned), active=status == "closed"),
        Tab("All", url=url("all", assigned), active=status == "all"),
        Tab(
            "Assigned to me",
            url=url(status, "all" if assigned == "me" else "me"),
            active=assigned == "me",
            extra_classes="ml-auto",
        ),
        Tab(
            "Unassigned",
            url=url(status, "all" if assigned == "unassigned" else "unassigned"),
            active=assigned == "unassigned",
        ),
    ]


def _status_badge(is_open: bool) -> None:
    variant = "badge-success" if is_open else "badge-ghost"
    with tag.div(classes=f"badge {variant} badge-sm"):
        text("Open" if is_open else "Closed")


def _render_table(request: Request, rows: Sequence[Row]) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra"):
            with tag.thead():
                with tag.tr():
                    for header in (
                        "Organization",
                        "Type",
                        "Status",
                        "Assignee",
                        "Opened",
                    ):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for (
                    case,
                    organization,
                    is_open,
                    assignee_email,
                    awaiting_platform,
                ) in rows:
                    case_url = (
                        str(
                            request.url_for(
                                "organizations:detail",
                                organization_id=organization.id,
                            )
                        )
                        + "?section=support_case"
                    )
                    with tag.tr(
                        classes="hover cursor-pointer",
                        _=f"on click set window.location to '{case_url}'",
                    ):
                        with tag.td():
                            with tag.a(href=case_url, classes="link"):
                                text(organization.name)
                        with tag.td():
                            with tag.div(classes="badge badge-outline badge-sm"):
                                text("Review appeal")
                        with tag.td():
                            with tag.div(classes="flex items-center gap-2"):
                                _status_badge(is_open)
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


@router.get(
    "/attachments/{attachment_id}/download",
    name="support_cases:attachment_download",
    response_model=None,
)
async def download_attachment(
    attachment_id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
    user_session: UserSession = Depends(get_admin),
) -> RedirectResponse:
    """Redirect to a presigned download URL for a case attachment."""
    del user_session  # admin gate only
    attachment = await SupportCaseAttachmentRepository.from_session(session).get_by_id(
        attachment_id, options=(joinedload(SupportCaseAttachment.file),)
    )
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    url, _ = file_service.generate_download_url(attachment.file)
    return RedirectResponse(url)


@router.get("/", name="support_cases:list")
async def list_cases(
    request: Request,
    pagination: PaginationParamsQuery,
    status: Annotated[str, Query()] = "open",
    assigned: Annotated[str, Query()] = "all",
    session: AsyncSession = Depends(get_db_read_session),
    user_session: UserSession = Depends(get_admin),
) -> None:
    is_open = SupportCaseMessageRepository.is_open_expression()
    awaiting_platform = SupportCaseMessageRepository.awaiting_platform_expression()
    statement = (
        select(
            ReviewAppealSupportCase,
            Organization,
            is_open.label("is_open"),
            User.email.label("assignee_email"),
            awaiting_platform.label("awaiting_platform"),
        )
        .join(
            OrganizationReview,
            ReviewAppealSupportCase.organization_review_id == OrganizationReview.id,
        )
        .join(Organization, OrganizationReview.organization_id == Organization.id)
        .outerjoin(User, ReviewAppealSupportCase.assigned_user_id == User.id)
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

    if assigned == "me":
        mine = ReviewAppealSupportCase.assigned_user_id == user_session.user_id
        statement = statement.where(mine)
        count_statement = count_statement.where(mine)
    elif assigned == "unassigned":
        unassigned = ReviewAppealSupportCase.assigned_user_id.is_(None)
        statement = statement.where(unassigned)
        count_statement = count_statement.where(unassigned)

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
            with tab_nav(_list_tabs(request, status, assigned)):
                pass
            if rows:
                _render_table(request, rows)
            else:
                with tag.div(classes="text-center py-12 text-base-content/50"):
                    text("No cases in this view.")
            with datatable.pagination(request, pagination, count):
                pass
