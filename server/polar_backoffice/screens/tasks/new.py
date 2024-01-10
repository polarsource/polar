import importlib
from collections.abc import Callable, Iterator
from typing import Any, cast, get_type_hints

from arq.worker import Function as WorkerFunction
from pydantic import ValidationError, create_model
from textual import work
from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Input, Select

from polar.worker import WorkerSettings, enqueue_job


def get_function_arguments(f: Callable[..., Any]) -> Iterator[tuple[str, Any]]:
    for key, type_hint in get_type_hints(f).items():
        if key in {"ctx", "polar_context", "return"}:
            continue
        yield key, type_hint


class NewTaskModal(ModalScreen[bool]):
    DEFAULT_CSS = """
    NewTaskModal {
        align: center middle;
    }

    #dialog {
        padding: 0 1;
        width: 50%;
        height: 50%;
        border: thick $background 80%;
        background: $surface;
    }

    .field {
        margin-bottom: 1;
    }

    #buttons {
        width: 100%;
        height: auto;
        dock: bottom;
    }

    #buttons Button {
        width: 50%;
        margin: 0 1;
    }
    """

    _tasks: dict[str, WorkerFunction] = {}
    _selected_task: str | None = None
    _form_widgets: dict[str, Input] = {}

    def __init__(
        self, name: str | None = None, id: str | None = None, classes: str | None = None
    ) -> None:
        self._tasks = self._get_tasks()
        super().__init__(name, id, classes)

    def compose(self) -> ComposeResult:
        yield Vertical(
            Select(
                [(k, k) for k in self._tasks.keys()],
                prompt="Select task",
                classes="field",
            ),
            Horizontal(
                Button("Cancel", id="cancel"),
                Button("Confirm", variant="primary", id="confirm"),
                id="buttons",
            ),
            id="dialog",
        )

    def on_select_changed(self, event: Select.Changed) -> None:
        for widget in self._form_widgets.values():
            widget.remove()

        if event.value == Select.BLANK:
            self._selected_task = None
            return

        self._selected_task = cast(str, event.value)
        task_function = self._tasks[self._selected_task]

        form_widgets: dict[str, Input] = {}
        for key, type_hint in get_function_arguments(task_function.coroutine):
            form_widgets[key] = Input(placeholder=f"{key} {type_hint}")

        self.mount(*form_widgets.values(), after=event.select)
        self._form_widgets = form_widgets

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "confirm":
            self.create_job()
        else:
            self.dismiss(False)

    def _get_tasks(self) -> dict[str, WorkerFunction]:
        importlib.import_module("polar.tasks")
        tasks_definitions: dict[str, WorkerFunction] = {}
        for f in WorkerSettings.functions:
            tasks_definitions[f.name] = f
        return tasks_definitions

    @work(exclusive=True)
    async def create_job(self) -> None:
        if self._selected_task is None:
            self.app.notify("Select a task to enqueue", severity="error")
            return

        task_function = self._tasks[self._selected_task]
        field_definitions: dict[str, tuple[type, Any]] = {
            key: (type_hint, ...)
            for key, type_hint in get_function_arguments(task_function.coroutine)
        }
        JobKwargsModel = create_model(
            "JobKwargsModel",
            **field_definitions,  # type: ignore
        )

        raw_job_kwargs: dict[str, Any] = {}
        for key, _ in get_function_arguments(task_function.coroutine):
            form_widget = self._form_widgets[key]
            value = form_widget.value
            raw_job_kwargs[key] = value

        try:
            job_kwargs = JobKwargsModel(**raw_job_kwargs)
        except ValidationError as e:
            self.app.notify(
                e.json(), title="Validation errors", severity="error", timeout=30
            )
        else:
            await enqueue_job(self._selected_task, **job_kwargs.dict())
            self.app.notify("Task successfully enqueued")
            self.dismiss(True)
