from collections.abc import Sequence
from operator import attrgetter
from typing import Any

from fastapi import APIRouter, Query, Request
from pydantic import ValidationError
from tagflow import tag, text

from polar.worker import enqueue_job

from ..components import button, datatable, input, modal
from ..layout import layout
from ..toast import add_toast
from .forms import build_enqueue_task_form_class

router = APIRouter()


# class ExecutionTimeColumn(datatable.DatatableColumn[JobResult]):
#     def render(self, request: Request, item: JobResult) -> None:
#         execution_time = item.finish_time - item.start_time
#         formatted_execution_time = format_decimal(
#             execution_time.total_seconds(), locale="en_US"
#         )
#         text(formatted_execution_time)


@router.get("/", name="tasks:list")
async def list(
    request: Request,
    query: str | None = Query(None),
) -> None:
    items: Sequence[Any] = []
    if query:
        cursor = 0
        # while True:
        #     cursor, keys = await arq_pool.scan(
        #         cursor, f"{result_key_prefix}{query}*", count=500
        #     )
        #     for value in await arq_pool.mget(keys):
        #         if value is not None:
        #             try:
        #                 items.append(
        #                     deserialize_result(
        #                         value, deserializer=arq_pool.job_deserializer
        #                     )
        #                 )
        #             except DeserializationError:
        #                 pass

        #     if cursor == 0:
        #         break

        items = sorted(items, key=attrgetter("enqueue_time"), reverse=True)

    with layout(
        request,
        [
            ("Tasks", str(request.url_for("tasks:list"))),
        ],
        "tasks:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.h1(classes="text-4xl"):
                text("Tasks")
            with tag.div(classes="w-full flex flex-row justify-between"):
                with tag.form(method="GET"):
                    with input.search("query", query):
                        pass
                with button(
                    variant="primary",
                    hx_get=str(request.url_for("tasks:enqueue")),
                    hx_target="#modal",
                ):
                    text("Enqueue Task")

            with datatable.Datatable[Any, Any](
                datatable.DatatableDateTimeColumn("enqueue_time", "Enqueue Time"),
                datatable.DatatableDateTimeColumn("start_time", "Start Time"),
                # ExecutionTimeColumn("Execution Time"),
                datatable.DatatableAttrColumn("function", "Name", clipboard=True),
                datatable.DatatableAttrColumn("job_try", "Try"),
                datatable.DatatableBooleanColumn("success", "Success"),
                empty_message="Enter a query to find tasks" if not query else None,
            ).render(request, items):
                pass


@router.api_route("/enqueue", name="tasks:enqueue", methods=["GET", "POST"])
async def enqueue(request: Request, task: str | None = Query(None)) -> Any:
    form_class = build_enqueue_task_form_class(request, task)
    validation_error: ValidationError | None = None
    if request.method == "POST":
        data = await request.form()
        try:
            enqueue_task_payload = form_class.model_validate_form(data)
            enqueue_job(
                enqueue_task_payload.task,
                **enqueue_task_payload.model_dump(exclude={"task"}),
            )
            await add_toast(request, "Task has been enqueued.", "success")
            return
        except ValidationError as e:
            validation_error = e

    with modal("Enqueue task", open=True):
        with form_class.render(
            {"task": task},
            method="POST",
            classes="flex flex-col",
            validation_error=validation_error,
        ):
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
                    text("Enqueue")
