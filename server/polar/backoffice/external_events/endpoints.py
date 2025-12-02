import urllib.parse
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import or_
from tagflow import tag, text

from polar.external_event import sorting
from polar.external_event.repository import ExternalEventRepository
from polar.external_event.service import external_event as external_event_service
from polar.external_event.sorting import ExternalEventSortProperty
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from ..components import button, datatable, input, modal
from ..layout import layout
from ..toast import add_toast


def _get_logfire_url(event: ExternalEvent) -> str:
    params = {
        "q": f"attributes->>'actor' = '{event.task_name}' AND attributes->'message'->'args'->>0 = '{event.id}'",
        "since": event.created_at.isoformat(),
    }
    return f"https://logfire-us.pydantic.dev/polar/production-worker?{urllib.parse.urlencode(params)}"


router = APIRouter()


@router.get("/", name="external_events:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    handled: Annotated[bool | None, BeforeValidator(empty_str_to_none), Query()] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = ExternalEventRepository.from_session(session)
    statement = repository.get_base_statement()

    if query:
        try:
            statement = statement.where(ExternalEvent.id == uuid.UUID(query))
        except ValueError:
            statement = statement.where(
                or_(
                    ExternalEvent.external_id.ilike(f"%{query}%"),
                    ExternalEvent.task_name.ilike(f"%{query}%"),
                )
            )

    if handled is not None:
        statement = statement.where(ExternalEvent.is_handled == handled)

    statement = repository.apply_sorting(statement, sorting)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [
            ("External Events", str(request.url_for("external_events:list"))),
        ],
        "external_events:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("External Events")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search("query", query):
                    pass
                with input.select(
                    [
                        ("All Statuses", ""),
                        ("Handled", "true"),
                        ("Unhandled", "false"),
                    ],
                    "" if handled is None else str(handled).lower(),
                    name="handled",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with datatable.Datatable[ExternalEvent, ExternalEventSortProperty](
                datatable.DatatableActionsColumn(
                    "",
                    datatable.DatatableActionLink[ExternalEvent](
                        "View in Logfire",
                        lambda _, i: _get_logfire_url(i),
                        target="_blank",
                    ),
                    datatable.DatatableActionHTMX[ExternalEvent](
                        "Resend",
                        lambda r, i: str(r.url_for("external_events:resend", id=i.id)),
                        target="#modal",
                        hidden=lambda _, i: i.is_handled,
                    ),
                ),
                datatable.DatatableAttrColumn("id", "ID", clipboard=True),
                datatable.DatatableDateTimeColumn(
                    "created_at",
                    "Created At",
                    sorting=ExternalEventSortProperty.created_at,
                ),
                datatable.DatatableDateTimeColumn(
                    "handled_at",
                    "Handled At",
                    sorting=ExternalEventSortProperty.handled_at,
                ),
                datatable.DatatableAttrColumn("source", "Source"),
                datatable.DatatableAttrColumn(
                    "external_id",
                    "External ID",
                    external_href=lambda _,
                    item: f"https://dashboard.stripe.com/events/{item.external_id}"
                    if item.source == ExternalEventSource.stripe
                    else None,
                ),
                datatable.DatatableAttrColumn("task_name", "Task Name", clipboard=True),
            ).render(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.api_route(
    "/{id}/resend", name="external_events:resend", methods=["GET", "POST"]
)
async def resend(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ExternalEventRepository.from_session(session)
    external_event = await repository.get_by_id(id)

    if external_event is None:
        raise HTTPException(status_code=404)

    if request.method == "POST":
        await external_event_service.resend(external_event)
        await add_toast(request, "Event has been enqueued for processing.", "success")
        return

    with modal(f"Resend Event {external_event.id}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p():
                text("Are you sure you want to resend this event? ")
                text("It'll be enqueued for processing again using the task ")
                with tag.code():
                    text(external_event.task_name)
                text(".")
            with tag.div(classes="modal-action"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="button",
                    variant="primary",
                    hx_post=str(request.url),
                    hx_target="#modal",
                ):
                    text("Resend")
