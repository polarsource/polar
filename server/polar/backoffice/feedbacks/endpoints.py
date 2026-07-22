from collections.abc import Sequence
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import UUID4, Field, ValidationError
from sqlalchemy.orm import joinedload
from tagflow import attr, document, tag, text

from polar.feedback.repository import FeedbackRepository
from polar.integrations.plain.service import PlainServiceError, plain
from polar.kit.pagination import PaginationParamsQuery
from polar.models import Feedback
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from .. import forms
from ..components import (
    button,
    confirmation_dialog,
    datatable,
    description_list,
    support_tier_badge,
)
from ..components._tab_nav import Tab, tab_nav
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from ._markdown import render_markdown


class UpdateFeedbackNoteForm(forms.BaseForm):
    internal_note: Annotated[
        str,
        forms.TextAreaField(
            rows=4,
            placeholder=(
                "Triage notes — e.g. link to the GitHub issue this feedback "
                "spawned, or any context for whoever picks it up next."
            ),
        ),
        Field(default="", title="Internal note"),
    ]


class UpdateSupportThreadURLForm(forms.BaseForm):
    support_thread_url: Annotated[
        str,
        forms.InputField(
            type="url",
            placeholder="https://app.plain.com/workspace/.../thread/...",
        ),
        Field(default="", title="Support thread URL"),
    ]


router = APIRouter()


def _type_badge(feedback_type: FeedbackType) -> None:
    with tag.div(classes="badge badge-outline"):
        text(str(feedback_type))


def _status_badge(status: FeedbackStatus) -> None:
    variant = "badge-warning" if status == FeedbackStatus.new else "badge-success"
    with tag.div(classes=f"badge {variant}"):
        text(str(status))


def _with_type(url: str, feedback_type: FeedbackType | None) -> str:
    if feedback_type is None:
        return url
    return f"{url}?type={feedback_type.value}"


def _list_tabs(
    request: Request,
    *,
    active: FeedbackStatus,
    feedback_type: FeedbackType | None,
) -> list[Tab]:
    return [
        Tab(
            "Inbox",
            url=_with_type(str(request.url_for("feedbacks:list")), feedback_type),
            active=active == FeedbackStatus.new,
        ),
        Tab(
            "Triaged",
            url=_with_type(
                str(request.url_for("feedbacks:list_triaged")), feedback_type
            ),
            active=active == FeedbackStatus.triaged,
        ),
    ]


def _type_tabs(
    *,
    list_url: str,
    active_type: FeedbackType | None,
    counts: dict[FeedbackType, int],
) -> list[Tab]:
    tabs = [
        Tab(
            "All",
            url=list_url,
            active=active_type is None,
            count=sum(counts.values()),
        )
    ]
    for feedback_type in FeedbackType:
        tabs.append(
            Tab(
                str(feedback_type).capitalize(),
                url=_with_type(list_url, feedback_type),
                active=active_type == feedback_type,
                count=counts.get(feedback_type, 0),
            )
        )
    return tabs


async def _render_list(
    request: Request,
    session: AsyncSession,
    pagination: PaginationParamsQuery,
    *,
    status: FeedbackStatus,
    route_name: str,
    breadcrumb_label: str,
    feedback_type: FeedbackType | None,
    sort: str,
) -> None:
    repository = FeedbackRepository.from_session(session)
    statement = repository.get_by_status_statement(status, sort=sort).options(
        joinedload(Feedback.user), joinedload(Feedback.organization)
    )
    if feedback_type is not None:
        statement = statement.where(Feedback.type == feedback_type)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )
    type_counts = await repository.get_type_counts(status)

    with layout(
        request,
        [
            ("Feedback", str(request.url_for("feedbacks:list"))),
            (breadcrumb_label, str(request.url)),
        ],
        route_name,
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Feedback")
            with tab_nav(
                _list_tabs(request, active=status, feedback_type=feedback_type)
            ):
                pass
            with tag.div(classes="flex"):
                with tab_nav(
                    _type_tabs(
                        list_url=str(request.url_for(route_name)),
                        active_type=feedback_type,
                        counts=type_counts,
                    )
                ):
                    pass
            if items:
                _render_table(request, items, sort)
            else:
                with tag.div(classes="text-center py-12 text-gray-500"):
                    text("No feedback in this view.")
            with datatable.pagination(request, pagination, count):
                pass


def _tier_sort_header(request: Request, sort: str) -> None:
    """Clickable 'Tier' header toggling the opt-in tier sort, preserving the
    current tab (inbox/triaged) and type filter."""
    params = dict(request.query_params)
    params["sort"] = "recency" if sort == "tier" else "tier"
    query = "&".join(f"{k}={v}" for k, v in params.items())
    with tag.a(href=f"{request.url.path}?{query}", classes="link link-hover"):
        text("Tier ↓" if sort == "tier" else "Tier")


def _render_table(request: Request, items: Sequence[Feedback], sort: str) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra"):
            with tag.thead():
                with tag.tr():
                    with tag.th():
                        text("Type")
                    with tag.th():
                        text("Message")
                    with tag.th():
                        text("Organization")
                    with tag.th():
                        _tier_sort_header(request, sort)
                    for header in ("User", "Submitted"):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for feedback in items:
                    _render_row(request, feedback)


def _render_row(request: Request, feedback: Feedback) -> None:
    detail_url = str(request.url_for("feedbacks:get", id=feedback.id))
    with tag.tr(
        classes="hover cursor-pointer", onclick=f"window.location='{detail_url}'"
    ):
        with tag.td():
            _type_badge(feedback.type)
        with tag.td(classes="max-w-md truncate"):
            with tag.a(href=detail_url, classes="link"):
                text(feedback.message[:120])
        with tag.td():
            with tag.a(
                href=str(
                    request.url_for(
                        "organizations:detail", organization_id=feedback.organization_id
                    )
                ),
                classes="link",
            ):
                text(feedback.organization.name)
        with tag.td():
            support_tier_badge(feedback.organization.support_tier)
        with tag.td():
            with tag.a(
                href=str(request.url_for("users:get", id=feedback.user_id)),
                classes="link",
            ):
                text(feedback.user.email)
        with tag.td():
            text(feedback.created_at.strftime("%Y-%m-%d %H:%M"))


@router.get("/", name="feedbacks:list")
async def list_inbox(
    request: Request,
    pagination: PaginationParamsQuery,
    feedback_type: Annotated[FeedbackType | None, Query(alias="type")] = None,
    sort: Annotated[str, Query()] = "recency",
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    await _render_list(
        request,
        session,
        pagination,
        status=FeedbackStatus.new,
        route_name="feedbacks:list",
        breadcrumb_label="Inbox",
        feedback_type=feedback_type,
        sort=sort,
    )


@router.get("/triaged", name="feedbacks:list_triaged")
async def list_triaged(
    request: Request,
    pagination: PaginationParamsQuery,
    feedback_type: Annotated[FeedbackType | None, Query(alias="type")] = None,
    sort: Annotated[str, Query()] = "recency",
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    await _render_list(
        request,
        session,
        pagination,
        status=FeedbackStatus.triaged,
        route_name="feedbacks:list_triaged",
        breadcrumb_label="Triaged",
        feedback_type=feedback_type,
        sort=sort,
    )


async def _get_or_404(session: AsyncSession, id: UUID4) -> Feedback:
    repository = FeedbackRepository.from_session(session)
    feedback = await repository.get_by_id(
        id,
        options=(joinedload(Feedback.user), joinedload(Feedback.organization)),
    )
    if feedback is None:
        raise HTTPException(status_code=404)
    return feedback


@router.get("/{id}", name="feedbacks:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    feedback = await _get_or_404(session, id)

    with layout(
        request,
        [
            ("Feedback", str(request.url_for("feedbacks:list"))),
            (str(feedback.id)[:8], str(request.url)),
        ],
        "feedbacks:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-start gap-4"):
                with tag.div(classes="flex flex-col gap-2"):
                    with tag.h1(classes="text-4xl"):
                        text("Feedback")
                    with tag.div(classes="flex items-center gap-2"):
                        _type_badge(feedback.type)
                        _status_badge(feedback.status)
                        with tag.span(classes="text-sm text-gray-500"):
                            text(feedback.created_at.strftime("%Y-%m-%d %H:%M UTC"))
                with tag.div(classes="flex items-center gap-2"):
                    if feedback.status == FeedbackStatus.new:
                        with button(
                            hx_post=str(
                                request.url_for("feedbacks:triage", id=feedback.id)
                            ),
                            variant="primary",
                        ):
                            text("Mark as triaged")
                    with button(
                        hx_get=str(request.url_for("feedbacks:delete", id=feedback.id)),
                        hx_target="#modal",
                        variant="error",
                        ghost=True,
                    ):
                        text("Delete")

            # Message (rendered Markdown) — full width
            with tag.div(classes="card card-border w-full shadow-sm"):
                with tag.div(classes="card-body"):
                    with tag.h2(classes="card-title"):
                        text("Message")
                    with tag.div(
                        classes=(
                            "prose prose-sm max-w-none "
                            "prose-pre:whitespace-pre-wrap prose-pre:break-words"
                        )
                    ):
                        render_markdown(feedback.message)

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-3 gap-4"):
                # Submitted by
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Submitted by")
                        with description_list.DescriptionList[Feedback](
                            description_list.DescriptionListLinkItem[Feedback](
                                "user.email",
                                "User",
                                href_getter=lambda r, i: str(
                                    r.url_for("users:get", id=i.user_id)
                                ),
                            ),
                            description_list.DescriptionListLinkItem[Feedback](
                                "organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:detail",
                                        organization_id=i.organization_id,
                                    )
                                ),
                            ),
                            description_list.DescriptionListAttrItem(
                                "organization.slug", "Slug"
                            ),
                        ).render(request, feedback):
                            pass

                # Client context
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Client context")
                        if feedback.client_context:
                            with tag.dl(
                                classes=(
                                    "grid grid-cols-[max-content_1fr] gap-x-4 "
                                    "gap-y-1 text-sm"
                                )
                            ):
                                for key, value in sorted(
                                    feedback.client_context.items()
                                ):
                                    with tag.dt(classes="font-semibold"):
                                        text(key)
                                    with tag.dd(
                                        classes=(
                                            "font-mono whitespace-pre-wrap break-all"
                                        )
                                    ):
                                        text(_format_context_value(value))
                        else:
                            with tag.p(classes="text-gray-500"):
                                text("No client context captured.")

                # Support thread + Internal note (stacked in the same column)
                with tag.div(classes="flex flex-col gap-4"):
                    # Support thread
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Support thread")
                            with UpdateSupportThreadURLForm.render(
                                data={
                                    "support_thread_url": feedback.support_thread_url
                                    or ""
                                },
                                hx_post=str(
                                    request.url_for(
                                        "feedbacks:update_support_thread_url",
                                        id=feedback.id,
                                    )
                                ),
                                classes="flex flex-col gap-2",
                            ):
                                with tag.div(
                                    classes="flex flex-wrap justify-end gap-2"
                                ):
                                    with button(
                                        type="submit",
                                        size="sm",
                                        ghost=True,
                                    ):
                                        text("Save URL")
                                    if feedback.support_thread_url:
                                        with tag.a(
                                            href=feedback.support_thread_url,
                                            target="_blank",
                                            rel="noopener noreferrer",
                                            classes="btn btn-sm btn-primary",
                                        ):
                                            text("Open thread ↗")
                                    else:
                                        with button(
                                            hx_post=str(
                                                request.url_for(
                                                    "feedbacks:reply_in_plain",
                                                    id=feedback.id,
                                                )
                                            ),
                                            variant="primary",
                                            size="sm",
                                        ):
                                            text("Reply in Plain")

                    # Internal note
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.div(
                                classes="flex items-center justify-between gap-2"
                            ):
                                with tag.h2(classes="card-title"):
                                    text("Internal note")
                                if feedback.internal_note and feedback.modified_at:
                                    with tag.span(classes="text-xs text-gray-500"):
                                        text(
                                            "Updated "
                                            + feedback.modified_at.strftime(
                                                "%Y-%m-%d %H:%M UTC"
                                            )
                                        )
                            note_post_url = str(
                                request.url_for("feedbacks:update_note", id=feedback.id)
                            )
                            with UpdateFeedbackNoteForm.render(
                                data={"internal_note": feedback.internal_note or ""},
                                hx_post=note_post_url,
                                classes="flex flex-col gap-2",
                            ):
                                with tag.div(classes="flex justify-end gap-2"):
                                    # Each action posts explicitly with its own
                                    # `action` value rather than relying on the
                                    # submit button being detected as the form's
                                    # submitter (which is brittle, especially with
                                    # the global "disable submit buttons during
                                    # request" behaviour). `hx-include` pulls in the
                                    # textarea value alongside the action.
                                    with button(
                                        type="button",
                                        hx_post=note_post_url,
                                        hx_include="closest form",
                                        hx_vals='{"action": "save"}',
                                        hx_disabled_elt="this",
                                        size="sm",
                                        ghost=True,
                                    ):
                                        text("Save note")
                                    if feedback.status == FeedbackStatus.new:
                                        with button(
                                            type="button",
                                            hx_post=note_post_url,
                                            hx_include="closest form",
                                            hx_vals='{"action": "save_and_triage"}',
                                            hx_disabled_elt="this",
                                            variant="primary",
                                            size="sm",
                                        ):
                                            text("Save & Mark as triaged")


def _format_context_value(value: Any) -> str:
    if isinstance(value, dict):
        return ", ".join(f"{k}: {v}" for k, v in value.items())
    return str(value)


@router.post("/{id}/triage", name="feedbacks:triage")
async def triage(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = FeedbackRepository.from_session(session)
    feedback = await repository.get_by_id(id)
    if feedback is None:
        raise HTTPException(status_code=404)
    if feedback.status != FeedbackStatus.new:
        raise HTTPException(status_code=400, detail="Feedback is already triaged.")

    await repository.update(feedback, update_dict={"status": FeedbackStatus.triaged})
    await add_toast(request, "Feedback marked as triaged.", "success")
    return HXRedirectResponse(
        request, str(request.url_for("feedbacks:get", id=feedback.id))
    )


@router.post("/{id}/note", name="feedbacks:update_note")
async def update_note(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = FeedbackRepository.from_session(session)
    feedback = await repository.get_by_id(id)
    if feedback is None:
        raise HTTPException(status_code=404)

    form_data = await request.form()
    try:
        form = UpdateFeedbackNoteForm.model_validate_form(form_data)
    except ValidationError:
        await add_toast(request, "Could not save the note.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("feedbacks:get", id=feedback.id))
        )

    note = form.internal_note.strip() or None
    update_dict: dict[str, Any] = {"internal_note": note}

    triage = (
        form_data.get("action") == "save_and_triage"
        and feedback.status == FeedbackStatus.new
    )
    if triage:
        update_dict["status"] = FeedbackStatus.triaged

    await repository.update(feedback, update_dict=update_dict)
    await add_toast(
        request,
        "Note saved and feedback marked as triaged." if triage else "Note saved.",
        "success",
    )
    return HXRedirectResponse(
        request, str(request.url_for("feedbacks:get", id=feedback.id))
    )


@router.post("/{id}/support-thread-url", name="feedbacks:update_support_thread_url")
async def update_support_thread_url(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = FeedbackRepository.from_session(session)
    feedback = await repository.get_by_id(id)
    if feedback is None:
        raise HTTPException(status_code=404)

    form_data = await request.form()
    try:
        form = UpdateSupportThreadURLForm.model_validate_form(form_data)
    except ValidationError:
        await add_toast(request, "Please enter a valid URL.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("feedbacks:get", id=feedback.id))
        )

    url = form.support_thread_url.strip() or None
    await repository.update(feedback, update_dict={"support_thread_url": url})
    await add_toast(
        request,
        "Support thread URL updated." if url else "Support thread URL cleared.",
        "success",
    )
    return HXRedirectResponse(
        request, str(request.url_for("feedbacks:get", id=feedback.id))
    )


@router.post("/{id}/reply-in-plain", name="feedbacks:reply_in_plain")
async def reply_in_plain(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    feedback = await _get_or_404(session, id)

    if feedback.support_thread_url:
        await add_toast(
            request,
            "A support thread is already linked. Clear the URL to create a new one.",
            "warning",
        )
        return HXRedirectResponse(
            request, str(request.url_for("feedbacks:get", id=feedback.id))
        )

    try:
        thread_url = await plain.create_feedback_thread(feedback)
    except PlainServiceError as e:
        await add_toast(request, f"Plain error: {e}", "error")
        return HXRedirectResponse(
            request, str(request.url_for("feedbacks:get", id=feedback.id))
        )
    except httpx.RequestError:
        await add_toast(
            request,
            "Plain request failed, please try again later.",
            "error",
        )
        return HXRedirectResponse(
            request, str(request.url_for("feedbacks:get", id=feedback.id))
        )

    repository = FeedbackRepository.from_session(session)
    await repository.update(feedback, update_dict={"support_thread_url": thread_url})
    await add_toast(request, "Support thread created in Plain.", "success")
    return HXRedirectResponse(
        request, str(request.url_for("feedbacks:get", id=feedback.id))
    )


@router.api_route("/{id}/delete", name="feedbacks:delete", methods=["GET", "POST"])
async def delete(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = FeedbackRepository.from_session(session)
    feedback = await repository.get_by_id(id)
    if feedback is None:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        await repository.soft_delete(feedback)
        await add_toast(request, "Feedback deleted.", "success")
        return HXRedirectResponse(request, str(request.url_for("feedbacks:list")))

    with document() as doc:
        with tag.div(id="modal"):
            with confirmation_dialog(
                "Delete feedback",
                "This will hide the feedback from both views. It can be restored "
                "from the database if needed.",
                variant="error",
                confirm_text="Delete",
                open=True,
            ):
                attr(
                    "hx-post",
                    str(request.url_for("feedbacks:delete", id=feedback.id)),
                )

    return HTMLResponse(str(doc))
