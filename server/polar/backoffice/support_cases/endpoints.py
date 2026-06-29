import uuid
from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import UUID4
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.dispute.repository import DisputeRepository
from polar.file.service import file as file_service
from polar.kit.pagination import PaginationParamsQuery, count_subquery
from polar.models import Organization, User
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCase,
    SupportCaseAttachment,
    SupportCaseAudience,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.support_case.repository import (
    SupportCaseAttachmentRepository,
    SupportCaseMessageRepository,
    SupportCaseRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.worker import enqueue_job

from ..components import datatable, dispute_status_badge, support_tier_badge
from ..components._tab_nav import Tab, tab_nav
from ..dependencies import get_admin
from ..layout import layout
from ..organizations_v2.views.sections.support_case_section import SupportCaseSection
from ..responses import HXRedirectResponse
from .queries import TYPE_LABELS, Row, cases_statement
from .urls import case_detail_url, is_safe_return_to

router = APIRouter()


def _list_url(
    request: Request, *, status: str, assigned: str, sort: str, case_type: str
) -> str:
    base = str(request.url_for("support_cases:list"))
    return f"{base}?status={status}&assigned={assigned}&sort={sort}&type={case_type}"


def _list_tabs(
    request: Request, status: str, assigned: str, sort: str, case_type: str
) -> list[Tab]:
    def url(new_status: str, new_assigned: str) -> str:
        return _list_url(
            request,
            status=new_status,
            assigned=new_assigned,
            sort=sort,
            case_type=case_type,
        )

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


def _type_tabs(
    request: Request, status: str, assigned: str, sort: str, case_type: str
) -> list[Tab]:
    def url(new_type: str) -> str:
        return _list_url(
            request,
            status=status,
            assigned=assigned,
            sort=sort,
            case_type=new_type,
        )

    return [
        Tab("All types", url=url("all"), active=case_type == "all"),
        Tab(
            "Appeals",
            url=url(SupportCaseType.review_appeal.value),
            active=case_type == SupportCaseType.review_appeal.value,
        ),
        Tab(
            "Disputes",
            url=url(SupportCaseType.dispute.value),
            active=case_type == SupportCaseType.dispute.value,
        ),
    ]


def _status_badge(is_open: bool) -> None:
    variant = "badge-success" if is_open else "badge-ghost"
    with tag.div(classes=f"badge {variant} badge-sm"):
        text("Open" if is_open else "Closed")


def _type_badge(case_type: SupportCaseType) -> None:
    with tag.div(classes="badge badge-outline badge-sm"):
        text(TYPE_LABELS.get(case_type, case_type.value))


def _tier_sort_header(request: Request, sort: str) -> None:
    """Clickable 'Tier' header that toggles the opt-in tier sort, preserving
    the current tab/assignment filters."""
    params = dict(request.query_params)
    params["sort"] = "recency" if sort == "tier" else "tier"
    query = "&".join(f"{k}={v}" for k, v in params.items())
    href = f"{request.url_for('support_cases:list')}?{query}"
    with tag.a(href=href, classes="link link-hover"):
        text("Tier ↓" if sort == "tier" else "Tier")


def _render_table(request: Request, rows: Sequence[Row], sort: str) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra"):
            with tag.thead():
                with tag.tr():
                    with tag.th():
                        text("Organization")
                    with tag.th():
                        _tier_sort_header(request, sort)
                    for header in (
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
                    _awaiting_platform,
                    unread,
                    dispute_status,
                ) in rows:
                    case_url = str(
                        request.url_for("support_cases:detail", case_id=case.id)
                    )
                    with tag.tr(
                        classes="hover cursor-pointer",
                        _=f"on click set window.location to '{case_url}'",
                    ):
                        with tag.td():
                            link_classes = "no-underline"
                            if unread:
                                link_classes += " font-semibold"
                            with tag.a(href=case_url, classes=link_classes):
                                text(organization.name)
                        with tag.td():
                            support_tier_badge(organization.support_tier)
                        with tag.td():
                            _type_badge(case.type)
                        with tag.td():
                            with tag.div(classes="flex items-center gap-2"):
                                _status_badge(is_open)
                                if dispute_status is not None:
                                    dispute_status_badge(dispute_status)
                                if unread:
                                    with tag.span(
                                        classes="tooltip text-warning",
                                        data_tip="Unread",
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
    """Same-site relative path only, falling back to the case list."""
    if is_safe_return_to(return_to):
        assert return_to is not None
        return return_to
    return str(request.url_for("support_cases:list"))


def _detail_redirect(
    request: Request, case_id: uuid.UUID, return_to: str | None = None
) -> HXRedirectResponse:
    return HXRedirectResponse(
        request, case_detail_url(request, case_id, return_to=return_to), 303
    )


async def _load_case_and_organization(
    session: AsyncSession, case_id: uuid.UUID
) -> tuple[SupportCase, Organization]:
    """Load a case and its organization (incl. soft-deleted/blocked), or raise 404."""
    case = await SupportCaseRepository.from_session(session).get_by_id(
        case_id, options=(joinedload(SupportCase.organization),)
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Support case not found")

    return case, case.organization


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


@router.post("/{case_id}/reply", name="support_cases:reply", response_model=None)
async def reply_case(
    request: Request,
    case_id: UUID4,
    return_to: Annotated[str | None, Query()] = None,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> HXRedirectResponse:
    """Post a staff reply (or internal note) to any case, then notify the
    organization if it's merchant-visible. Internal notes are allowed on closed
    cases too, so staff can keep following up after a decision."""
    case = await SupportCaseRepository.from_session(session).get_by_id(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Support case not found")

    message_repository = SupportCaseMessageRepository.from_session(session)
    is_open = await message_repository.is_open(case.id)

    form_data = await request.form()
    body = str(form_data.get("body", "")).strip()
    # A closed case is internal-notes-only: a merchant-facing message would
    # email the merchant with no accessible thread to follow up in.
    internal = bool(form_data.get("internal")) or not is_open

    if body:
        audience = [] if internal else [SupportCaseAudience.merchant]
        message = await support_case_service.post_message(
            session,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            author_user=user_session.user,
            body=body,
            audience=audience,
        )
        if not internal:
            enqueue_job(
                "support_case.notify_organization_of_new_message",
                message_id=message.id,
            )

    return _detail_redirect(request, case_id, return_to)


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


@router.get("/{case_id}", name="support_cases:detail")
async def case_detail(
    request: Request,
    case_id: UUID4,
    return_to: Annotated[str | None, Query()] = None,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> None:
    case, organization = await _load_case_and_organization(session, case_id)

    await support_case_service.mark_read(session, case, user=user_session.user)

    message_repository = SupportCaseMessageRepository.from_session(session)
    is_open = await message_repository.is_open(case.id)
    messages = await message_repository.list_by_case(case.id, visible_to=None)

    author_ids = {m.author_user_id for m in messages if m.author_user_id is not None}
    if case.assigned_user_id is not None:
        author_ids.add(case.assigned_user_id)
    author_emails: dict[uuid.UUID, str] = {}
    if author_ids:
        email_result = await session.execute(
            select(User.id, User.email).where(User.id.in_(author_ids))
        )
        author_emails = {row.id: row.email for row in email_result.all()}

    attachments_by_message: dict[uuid.UUID, list[SupportCaseAttachment]] = {}
    attachments = await SupportCaseAttachmentRepository.from_session(
        session
    ).list_by_case(case.id)
    for attachment in attachments:
        if attachment.message_id is not None:
            attachments_by_message.setdefault(attachment.message_id, []).append(
                attachment
            )

    dispute = None
    if isinstance(case, DisputeSupportCase):
        dispute = await DisputeRepository.from_session(session).get_by_id(
            case.dispute_id
        )

    section = SupportCaseSection(
        organization,
        thread=(case, is_open, messages),
        author_emails=author_emails,
        current_user_id=user_session.user_id,
        attachments_by_message=attachments_by_message,
        dispute=dispute,
        return_to=return_to if is_safe_return_to(return_to) else None,
    )

    came_from_org = is_safe_return_to(return_to)
    assert not came_from_org or return_to is not None
    back_href = (
        return_to if came_from_org else str(request.url_for("support_cases:list"))
    )
    back_label = "← Back to organization" if came_from_org else "← Back to cases"

    with layout(
        request,
        [
            (organization.name, case_detail_url(request, case.id, return_to=return_to)),
            ("Cases", str(request.url_for("support_cases:list"))),
        ],
        "support_cases:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.a(
                href=back_href,
                classes="link text-sm text-base-content/60",
            ):
                text(back_label)
            with section.render(request):
                pass


@router.get("/", name="support_cases:list")
async def list_cases(
    request: Request,
    pagination: PaginationParamsQuery,
    status: Annotated[str, Query()] = "open",
    assigned: Annotated[str, Query()] = "all",
    sort: Annotated[str, Query()] = "recency",
    type: Annotated[str, Query()] = "all",
    session: AsyncSession = Depends(get_db_read_session),
    user_session: UserSession = Depends(get_admin),
) -> None:
    statement = cases_statement(
        status=status,
        assigned=assigned,
        assigned_user_id=user_session.user_id,
        viewer_user_id=user_session.user_id,
        case_type=type,
        sort=sort,
    )
    count = (
        await session.scalar(
            select(func.count()).select_from(count_subquery(statement))
        )
        or 0
    )
    result = await session.execute(
        statement.limit(pagination.limit).offset(
            (pagination.page - 1) * pagination.limit
        )
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
            with tab_nav(_list_tabs(request, status, assigned, sort, type)):
                pass
            with tab_nav(_type_tabs(request, status, assigned, sort, type)):
                pass
            if rows:
                _render_table(request, rows, sort)
            else:
                with tag.div(classes="text-center py-12 text-base-content/50"):
                    text("No cases in this view.")
            with datatable.pagination(request, pagination, count):
                pass
