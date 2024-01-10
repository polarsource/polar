import asyncio
from collections.abc import AsyncIterator
from operator import attrgetter
from typing import TYPE_CHECKING

from arq.constants import result_key_prefix
from arq.jobs import JobResult, deserialize_result
from babel.dates import format_datetime
from babel.numbers import format_decimal
from textual import work
from textual.app import ComposeResult
from textual.screen import Screen
from textual.widgets import DataTable, Footer

from polar_backoffice.utils import system_timezone

from ...widgets.header import PolarHeader
from ...widgets.search_bar import SearchBar
from .new import NewTaskModal

if TYPE_CHECKING:
    from ...app import PolarBackOffice


class TasksListScreen(Screen[None]):
    BINDINGS = [
        ("ctrl+r", "refresh", "Refresh"),
        ("ctrl+f", "find", "Find"),
        ("ctrl+n", "enqueue_task", "Enqueue task"),
    ]

    app: "PolarBackOffice"  # type: ignore

    done_tasks: dict[str, JobResult] = {}
    search_query: str | None = None

    def compose(self) -> ComposeResult:
        yield PolarHeader()
        yield DataTable(cursor_type="row")
        yield Footer()
        yield SearchBar()

    def on_mount(self) -> None:
        self.sub_title = "Tasks"

        done_table = self.query_one(DataTable)
        done_table.add_columns(
            "Enqueued at",
            "Started at",
            "Execution time",
            "Name",
            "Try",
            "Success",
            "Result",
        )
        self.get_done_tasks()

    def action_refresh(self) -> None:
        self.get_done_tasks()

    def action_find(self) -> None:
        search_bar = self.query_one(SearchBar)
        search_bar.toggle()

    def action_enqueue_task(self) -> None:
        async def check_enqueue_task(enqueued: bool) -> None:
            if enqueued:
                await asyncio.sleep(0.5)
                self.get_done_tasks()

        self.app.push_screen(NewTaskModal(), check_enqueue_task)

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        row_key = event.row_key.value
        if row_key is None:
            return

        task = self.done_tasks[row_key]

    def on_search_bar_submitted(self, event: SearchBar.Submitted) -> None:
        self.search_query = event.query
        self.get_done_tasks()

    def on_search_bar_cleared(self, event: SearchBar.Cleared) -> None:
        self.search_query = None
        self.get_done_tasks()

    @work(exclusive=True)
    async def get_done_tasks(self) -> None:
        if self.app.arq_pool is None:
            self.app.notify("arq_pool is not initialized", severity="error")
            return

        table = self.query_one(DataTable)
        table.loading = True
        table.clear()

        async def tasks_iterator() -> AsyncIterator[list[JobResult]]:
            assert self.app.arq_pool is not None
            cursor = 0
            tasks: list[JobResult] = []
            while True:
                cursor, keys = await self.app.arq_pool.scan(
                    cursor, f"{result_key_prefix}{self.search_query or ''}*", count=500
                )
                for value in await self.app.arq_pool.mget(keys):
                    if value is not None:
                        tasks.append(
                            deserialize_result(
                                value, deserializer=self.app.arq_pool.job_deserializer
                            )
                        )

                yield sorted(tasks, key=attrgetter("enqueue_time"), reverse=True)

                if cursor == 0:
                    break

        async for tasks in tasks_iterator():
            table.loading = False
            table.clear()
            table.add_rows(
                (
                    format_datetime(
                        task.enqueue_time, locale="en_US", tzinfo=system_timezone()
                    ),
                    format_datetime(
                        task.start_time, locale="en_US", tzinfo=system_timezone()
                    ),
                    format_decimal(
                        (task.finish_time - task.start_time).total_seconds(),
                        locale="en_US",
                    ),
                    task.function,
                    task.job_try,
                    "✅" if task.success else "❌",
                    task.result,
                )
                for task in tasks
            )

        table.focus()
