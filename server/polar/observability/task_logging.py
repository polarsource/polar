import inspect
import logging
from typing import TYPE_CHECKING, Any

import dramatiq
import sentry_sdk

if TYPE_CHECKING:
    from sentry_sdk._types import Event, Hint

_task_fields: dict[str, tuple[inspect.Signature, dict[str, list[str]]]] = {}


def register_task_logging(
    actor: dramatiq.Actor[Any, Any], fields: tuple[str, ...]
) -> None:
    signature = inspect.signature(actor.fn)
    paths = {field: field.split(".") for field in fields}
    for field, path in paths.items():
        if path[0] not in signature.parameters:
            raise ValueError(
                f"Unknown log field {field!r} for actor {actor.actor_name}"
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
