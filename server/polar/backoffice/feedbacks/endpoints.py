from collections.abc import Sequence
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import UUID4, Field, ValidationError
from sqlalchemy.orm import joinedload
from tagflow import attr, document, tag, text

from polar.feedback.repository import FeedbackRepository
from polar.kit.pagination import PaginationParamsQuery
from polar.models import Feedback
from polar.models.feedback import FeedbackStatus, FeedbackType
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from .. import forms
from ..components import button, confirmation_dialog, datatable, description_list
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


router = APIRouter()


def _type_badge(feedback_type: FeedbackType) -> None:
    with tag.div(classes="badge badge-outline"):
        text(str(feedback_type))


def _status_badge(status: FeedbackStatus) -> None:
    variant = "badge-warning" if status == FeedbackStatus.new else "badge-success"
    with tag.div(classes=f"badge {variant}"):
        text(str(status))


def _list_tabs(request: Request, *, active: FeedbackStatus) -> list[Tab]:
    return [
        Tab(
            "Inbox",
            url=str(request.url_for("feedbacks:list")),
            active=active == FeedbackStatus.new,
        ),
        Tab(
            "Triaged",
            url=str(request.url_for("feedbacks:list_triaged")),
            active=active == FeedbackStatus.triaged,
        ),
    ]


async def _render_list(
    request: Request,
    session: AsyncSession,
    pagination: PaginationParamsQuery,
    *,
    status: FeedbackStatus,
    route_name: str,
    breadcrumb_label: str,
) -> None:
    repository = FeedbackRepository.from_session(session)
    statement = repository.get_by_status_statement(status).options(
        joinedload(Feedback.user), joinedload(Feedback.organization)
    )
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

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
            with tab_nav(_list_tabs(request, active=status)):
                pass
            if items:
                _render_table(request, items)
            else:
                with tag.div(classes="text-center py-12 text-gray-500"):
                    text("No feedback in this view.")
            with datatable.pagination(request, pagination, count):
                pass


def _render_table(request: Request, items: Sequence[Feedback]) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra"):
            with tag.thead():
                with tag.tr():
                    for header in (
                        "Type",
                        "Message",
                        "Organization",
                        "User",
                        "Submitted",
                    ):
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
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    await _render_list(
        request,
        session,
        pagination,
        status=FeedbackStatus.new,
        route_name="feedbacks:list",
        breadcrumb_label="Inbox",
    )


@router.get("/triaged", name="feedbacks:list_triaged")
async def list_triaged(
    request: Request,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    await _render_list(
        request,
        session,
        pagination,
        status=FeedbackStatus.triaged,
        route_name="feedbacks:list_triaged",
        breadcrumb_label="Triaged",
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
                            "prose max-w-none "
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

                # Internal note
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.div(classes="flex items-center justify-between gap-2"):
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
                        with UpdateFeedbackNoteForm.render(
                            data={"internal_note": feedback.internal_note or ""},
                            hx_post=str(
                                request.url_for("feedbacks:update_note", id=feedback.id)
                            ),
                            classes="flex flex-col gap-2",
                        ):
                            with tag.div(classes="flex justify-end gap-2"):
                                with button(
                                    type="submit",
                                    name="action",
                                    value="save",
                                    size="sm",
                                    ghost=True,
                                ):
                                    text("Save note")
                                if feedback.status == FeedbackStatus.new:
                                    with button(
                                        type="submit",
                                        name="action",
                                        value="save_and_triage",
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
