import json
import uuid
from collections.abc import Generator
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator
from sqlalchemy import func, or_, select
from tagflow import classes, tag, text

from polar.email.react import render_from_json
from polar.email.repository import EmailLogRepository
from polar.kit.pagination import PaginationParamsQuery
from polar.logging import Logger
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import AsyncSession, get_db_read_session

from ..components import button, datatable, description_list, input
from ..layout import layout

log: Logger = structlog.get_logger()

router = APIRouter()


def empty_str_to_none(v: str | None) -> str | None:
    if v == "":
        return None
    return v


class StatusColumn(datatable.DatatableColumn[EmailLog]):
    def __init__(self) -> None:
        super().__init__("Status")

    def render(self, request: Request, item: EmailLog) -> Generator[None] | None:
        with tag.div(classes="badge"):
            if item.status == EmailLogStatus.sent:
                classes("badge-success")
            elif item.status == EmailLogStatus.failed:
                classes("badge-error")
            text(str(item.status))
        return None


@router.get("/", name="email_logs:list")
async def list_email_logs(
    request: Request,
    pagination: PaginationParamsQuery,
    query: str | None = Query(None),
    status: Annotated[
        EmailLogStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    email_template: Annotated[
        str | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = EmailLogRepository.from_session(session)
    statement = repository.get_base_statement()

    if query is not None:
        try:
            parsed_uuid = uuid.UUID(query)
            statement = statement.where(
                or_(
                    EmailLog.id == parsed_uuid,
                    EmailLog.organization_id == parsed_uuid,
                )
            )
        except ValueError:
            query_lower = query.lower()
            statement = statement.where(
                or_(
                    func.lower(EmailLog.to_email_addr).ilike(f"%{query_lower}%"),
                    func.lower(EmailLog.subject).ilike(f"%{query_lower}%"),
                )
            )

    if status is not None:
        statement = statement.where(EmailLog.status == status)

    if email_template is not None:
        statement = statement.where(EmailLog.email_template == email_template)

    statement = statement.order_by(EmailLog.created_at.desc())
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    templates_stmt = (
        select(EmailLog.email_template)
        .where(EmailLog.email_template.is_not(None))
        .distinct()
        .order_by(EmailLog.email_template)
    )
    template_rows = (await session.execute(templates_stmt)).scalars().all()
    template_options = [(t, t) for t in template_rows if t is not None]

    status_options = [(s.value, s.value) for s in EmailLogStatus]

    with layout(
        request,
        [("Email Logs", str(request.url_for("email_logs:list")))],
        "email_logs:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Email Logs")
            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    name="query",
                    value=query,
                    placeholder="Search by email, subject, or UUID...",
                ):
                    pass
                with input.select(
                    status_options,
                    value=status.value if status else None,
                    name="status",
                    placeholder="All statuses",
                ):
                    pass
                with input.select(
                    template_options,
                    value=email_template,
                    name="email_template",
                    placeholder="All templates",
                ):
                    pass
                with button(type="submit"):
                    text("Search")
            with datatable.Datatable[EmailLog, Any](
                datatable.DatatableAttrColumn(
                    "id", "ID", clipboard=True, href_route_name="email_logs:get"
                ),
                StatusColumn(),
                datatable.DatatableAttrColumn("to_email_addr", "To"),
                datatable.DatatableAttrColumn("subject", "Subject"),
                datatable.DatatableAttrColumn("email_template", "Template"),
                datatable.DatatableAttrColumn("error", "Error"),
                datatable.DatatableDateTimeColumn("created_at", "Created At"),
            ).render(request, items):
                pass
            with datatable.pagination(request, pagination, count):
                pass


@router.get("/{id}", name="email_logs:get")
async def get_email_log(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = EmailLogRepository.from_session(session)
    email_log = await repository.get_by_id(id)

    if email_log is None:
        raise HTTPException(status_code=404)

    rendered_html: str | None = None
    if email_log.email_template is not None:
        try:
            rendered_html = render_from_json(
                email_log.email_template,
                json.dumps(email_log.email_props, default=str),
            )
        except Exception:
            log.warning(
                "email_log.render_failed",
                email_log_id=str(id),
                template=email_log.email_template,
            )

    with layout(
        request,
        [
            (str(email_log.id), str(request.url)),
            ("Email Logs", str(request.url_for("email_logs:list"))),
        ],
        "email_logs:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text(email_log.subject)

            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="flex flex-col gap-4"):
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Details")
                            with description_list.DescriptionList[EmailLog](
                                description_list.DescriptionListAttrItem(
                                    "id", "ID", clipboard=True
                                ),
                                StatusItem(),
                                description_list.DescriptionListAttrItem(
                                    "to_email_addr", "To", clipboard=True
                                ),
                                description_list.DescriptionListAttrItem(
                                    "from_email_addr", "From"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "from_name", "From Name"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "subject", "Subject"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "processor", "Processor"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "processor_id",
                                    "Processor ID",
                                    clipboard=True,
                                ),
                                description_list.DescriptionListAttrItem(
                                    "email_template", "Template"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "error", "Error"
                                ),
                                description_list.DescriptionListAttrItem(
                                    "organization_id",
                                    "Organization ID",
                                    clipboard=True,
                                ),
                                description_list.DescriptionListDateTimeItem(
                                    "created_at", "Created At"
                                ),
                            ).render(request, email_log):
                                pass

                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Template Props")
                            if email_log.email_props:
                                with tag.pre(
                                    classes="bg-base-200 rounded-box p-4 overflow-x-auto text-sm"
                                ):
                                    text(
                                        json.dumps(
                                            email_log.email_props,
                                            indent=2,
                                            default=str,
                                        )
                                    )
                            else:
                                with tag.p(classes="text-gray-500"):
                                    text("No props")

                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Rendered Email")
                        if rendered_html is not None:
                            with tag.iframe(
                                srcdoc=rendered_html,
                                sandbox="",
                                classes="w-full border-0 rounded-box",
                                style="min-height: 800px;",
                            ):
                                pass
                        else:
                            with tag.p(classes="text-gray-500"):
                                text("No template to render")


class StatusItem(description_list.DescriptionListItem[EmailLog]):
    def __init__(self) -> None:
        super().__init__("Status")

    def render(self, request: Request, item: EmailLog) -> Generator[None] | None:
        with tag.div(classes="badge"):
            if item.status == EmailLogStatus.sent:
                classes("badge-success")
            elif item.status == EmailLogStatus.failed:
                classes("badge-error")
            text(str(item.status))
        return None
