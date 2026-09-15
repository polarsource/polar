from logfire._internal.utils import span_to_dict
from opentelemetry.sdk.trace import (
    Event,
    ReadableSpan,
    SpanProcessor,
    SynchronousMultiSpanProcessor,
)
from opentelemetry.trace import Link, Status

from polar.observability.pii import scrub_event, scrub_value


class PiiSpanProcessor(SynchronousMultiSpanProcessor):
    def __init__(self, *processors: SpanProcessor) -> None:
        super().__init__()
        for processor in processors:
            self.add_span_processor(processor)

    def on_end(self, span: ReadableSpan) -> None:
        data = span_to_dict(span)
        data["name"] = scrub_value(data["name"])
        data["attributes"] = scrub_event(data["attributes"])
        data["events"] = [
            Event(
                name=scrub_value(event.name),
                attributes=scrub_event(event.attributes or {}),
                timestamp=event.timestamp,
            )
            for event in data["events"]
        ]
        data["links"] = [
            Link(
                context=link.context,
                attributes=scrub_event(link.attributes or {}),
            )
            for link in data["links"]
        ]
        status = data["status"]
        data["status"] = Status(
            status_code=status.status_code,
            description=scrub_value(status.description),
        )
        super().on_end(ReadableSpan(**data))
