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
from pydantic import Field, create_model, model_validator

from polar import tasks  # noqa

from .. import forms

_TASK_DEFINITIONS: dict[str, dramatiq.Actor[Any, Any]] = {
    name: actor for name, actor in dramatiq.get_broker().actors.items()
}
_TaskName = Literal[tuple(_TASK_DEFINITIONS.keys())]  # type: ignore[valid-type]


class EnqueueTaskParametersFormBase(forms.BaseForm):
    @model_validator(mode="before")
    @classmethod
    def _ignore_blank_values(cls, data: Any) -> Any:
        # Blank text inputs are submitted as empty strings. Treat them as
        # "not provided" so optional parameters fall back to their defaults
        # instead of failing type validation (e.g. "" is not a valid UUID).
        if isinstance(data, dict):
            return {key: value for key, value in data.items() if value != ""}
        return data


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
                typeddict_class = type_hints_args[0]
                optional_keys = typeddict_class.__optional_keys__
                for k, v in get_type_hints(typeddict_class).items():
                    if k in optional_keys:
                        yield k, v, None
                    else:
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
        parameter_definitions: dict[str, tuple[type, Any]] = {}
        for key, type_hint, param_default in _get_function_arguments(task_function.fn):
            if param_default is not inspect.Parameter.empty:
                default = param_default
            elif type_hint is bool:
                default = False
            else:
                default = ...
            parameter_definitions[key] = (type_hint, default)

        # Nest the task's own arguments under a dedicated sub-form so they can
        # never collide with the `task` selector field above. Some tasks accept
        # a parameter named `task` themselves (e.g. benefit.enqueue_benefits_grants).
        if parameter_definitions:
            parameters_model = create_model(
                "EnqueueTaskParametersForm",
                **parameter_definitions,  # type: ignore
                __base__=EnqueueTaskParametersFormBase,
            )
            field_definitions["parameters"] = (
                parameters_model,
                Field(title="Parameters"),
            )

    return create_model(
        "EnqueueTaskForm",
        **field_definitions,  # type: ignore
        __base__=forms.BaseForm,
    )
