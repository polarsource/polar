import inspect
import logging
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    Unpack,
    get_args,
    get_origin,
    get_type_hints,
)

import dramatiq
import sentry_sdk
from typing_extensions import is_typeddict

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

_task_fields: dict[str, tuple[inspect.Signature, dict[str, list[str]]]] = {}


class LoggableField:
    pass


def _loggable_paths(
    annotations: dict[str, Any], prefix: list[str]
) -> dict[str, list[str]]:
    paths: dict[str, list[str]] = {}
    for name, annotation in annotations.items():
        path = [*prefix, name]
        if get_origin(annotation) is Annotated:
            annotation, *metadata = get_args(annotation)
            if LoggableField in metadata:
                paths[".".join(path)] = path
                continue
        if get_origin(annotation) is Unpack:
            annotation = get_args(annotation)[0]
        if is_typeddict(annotation) or (
            isinstance(annotation, type) and issubclass(annotation, dict)
        ):
            paths.update(
                _loggable_paths(get_type_hints(annotation, include_extras=True), path)
            )
    return paths


def register_task_logging(actor: dramatiq.Actor[Any, Any]) -> None:
    fn = inspect.unwrap(actor.fn)
    signature = inspect.signature(fn)
    annotations = get_type_hints(fn, include_extras=True)
    paths = _loggable_paths(
        {
            name: annotations[name]
            for name in signature.parameters
            if name in annotations
        },
        [],
    )
    _task_fields[actor.actor_name] = (signature, paths)
    actor.logger.addFilter(TaskLogFilter())


def task_log_context(
    message: dramatiq.Message[Any] | dramatiq.MessageProxy,
) -> dict[str, Any]:
    arguments: dict[str, Any] = {}
    definition = _task_fields.get(message.actor_name)
    if definition is not None:
        signature, paths = definition
        if paths:
            try:
                bound = signature.bind_partial(*message.args, **message.kwargs)
            except TypeError:
                pass
            else:
                bound.apply_defaults()
                for field, path in paths.items():
                    value: Any = bound.arguments
                    for key in path:
                        if not isinstance(value, dict) or key not in value:
                            break
                        value = value[key]
                    else:
                        arguments[field] = value
    return {
        "actor_name": message.actor_name,
        "message_id": message.message_id,
        "queue_name": message.queue_name,
        "message_timestamp": message.message_timestamp,
        "retries": message.options.get("retries", 0),
        "arguments": arguments,
    }


def set_sentry_task_context(
    message: dramatiq.Message[Any] | dramatiq.MessageProxy,
) -> None:
    context = task_log_context(message)

    def process_event(event: Event, hint: Hint) -> Event:
        event.setdefault("contexts", {})["dramatiq"] = {
            "type": "dramatiq",
            "data": context,
        }
        return event

    sentry_sdk.get_isolation_scope().add_event_processor(process_event)


class TaskLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if record.msg == "Received args=%r kwargs=%r.":
            return False
        if not record.name.startswith("dramatiq."):
            return True
        if isinstance(record.args, tuple):
            record.args = tuple(
                task_log_context(value)
                if isinstance(value, dramatiq.Message | dramatiq.MessageProxy)
                else value
                for value in record.args
            )
        return True
