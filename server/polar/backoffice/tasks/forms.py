import inspect
from collections.abc import Callable, Iterator
from typing import (
    Annotated,
    Any,
    Literal,
    Unpack,
    get_args,
    get_origin,
    get_type_hints,
    is_typeddict,
)

import dramatiq
from fastapi import Request
from pydantic import Field, create_model

from polar import tasks  # noqa

from .. import forms

_TASK_DEFINITIONS: dict[str, dramatiq.Actor[Any, Any]] = {
    name: actor for name, actor in dramatiq.get_broker().actors.items()
}
_TaskName = Literal[tuple(_TASK_DEFINITIONS.keys())]  # type: ignore[valid-type]


def _get_function_arguments(
    f: Callable[..., Any],
) -> Iterator[tuple[str, Any, Any]]:
    signature = inspect.signature(f)
    for key, parameter in signature.parameters.items():
        if key in {"self"}:
            continue
        type_hint = parameter.annotation
        if get_origin(type_hint) is Unpack:
            type_hints_args = get_args(type_hint)
            if is_typeddict(type_hints_args[0]):
                for k, v in get_type_hints(type_hints_args[0]).items():
                    yield k, v, inspect.Parameter.empty
                return
            elif issubclass(type_hints_args[0], dict):
                yield from _get_function_arguments(type_hints_args[0].__init__)
                return
        yield key, type_hint, parameter.default


class EnqueueTaskFormBase(forms.BaseForm):
    task: str


def build_enqueue_task_form_class(
    request: Request, task: str | None
) -> type[EnqueueTaskFormBase]:
    field_definitions: dict[str, tuple[type, Any]] = {
        "task": (
            Annotated[
                _TaskName,  # type: ignore
                forms.SelectField(
                    [(name, name) for name in sorted(_TASK_DEFINITIONS.keys())],
                    hx_get=str(request.url_for("tasks:enqueue")),
                    hx_trigger="change",
                    hx_target="#modal",
                ),
                Field(title="Task"),
            ],
            ...,
        ),
    }
    if task is not None:
        task_function = _TASK_DEFINITIONS[task]
        for key, type_hint, param_default in _get_function_arguments(task_function.fn):
            if param_default is not inspect.Parameter.empty:
                default = param_default
            elif type_hint is bool:
                default = False
            else:
                default = ...
            field_definitions[key] = (type_hint, default)

    return create_model(
        "EnqueueTaskForm",
        **field_definitions,  # type: ignore
        __base__=forms.BaseForm,
    )
