from urllib.parse import urlsplit, urlunsplit

from opentelemetry.context import Context
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor
from opentelemetry.trace import Span as APISpan
from opentelemetry.trace import SpanKind
from starlette.types import Scope


def url_without_request_values(url: str, path: str = "/") -> str:
    try:
        parts = urlsplit(url)
        return urlunsplit((parts.scheme, parts.netloc.rsplit("@", 1)[-1], path, "", ""))
    except ValueError:
        return path


def request_path_template(scope: Scope) -> str:
    route = getattr(scope.get("route"), "path", None)
    if isinstance(route, str):
        return route
    span = scope.get("logfire.span")
    if isinstance(span, ReadableSpan) and span.attributes:
        route = span.attributes.get("http.route")
        if isinstance(route, str):
            return route
    return "/{unmatched}"


def sanitize_http_span(span: APISpan) -> None:
    if not isinstance(span, ReadableSpan) or not span.attributes:
        return
    attributes = span.attributes
    route = attributes.get("http.route")
    path = (
        route
        if isinstance(route, str)
        else ("/" if span.kind == SpanKind.CLIENT else "/{unmatched}")
    )
    for key in ("http.url", "url.full"):
        url = attributes.get(key)
        if isinstance(url, str):
            span.set_attribute(key, url_without_request_values(url, path))
    for key in ("http.target", "url.path"):
        if key in attributes:
            span.set_attribute(key, path)
    if "url.query" in attributes:
        span.set_attribute("url.query", "")


class HttpURLSpanProcessor(SpanProcessor):
    def on_start(self, span: Span, parent_context: Context | None = None) -> None:
        if span.instrumentation_scope and span.instrumentation_scope.name in (
            "opentelemetry.instrumentation.fastapi",
            "opentelemetry.instrumentation.httpx",
        ):
            # Request hooks run after Logfire can export a pending span.
            sanitize_http_span(span)


def server_request_hook(span: APISpan, scope: Scope) -> None:
    # ASGI reapplies the original attributes after the span processors run.
    sanitize_http_span(span)
