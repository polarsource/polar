import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

from slugify import slugify

_FIXED_PLACEHOLDERS = {"customer_name", "customer_email_local"}
_METADATA_PREFIX = "metadata."
_PLACEHOLDER_RE = re.compile(r"\{([^{}]*)\}")
_PLACEHOLDER_NAME_RE = re.compile(r"^[\w.]+$")
_METADATA_PLACEHOLDER_RE = re.compile(r"^metadata\.[^{}]+$")
_SLACK_CHANNEL_NAME_MAX_LENGTH = 80


@dataclass(frozen=True)
class TemplateContext:
    customer_name: str
    customer_email_local: str
    metadata: dict[str, Any] = field(default_factory=dict)


class InvalidTemplateError(ValueError):
    pass


def validate_template(template: str) -> None:
    for name in _iter_placeholder_names(template):
        if name in _FIXED_PLACEHOLDERS:
            continue
        if _METADATA_PLACEHOLDER_RE.fullmatch(name):
            continue
        raise InvalidTemplateError(
            f"Unknown placeholder: {{{name}}}. "
            f"Allowed: {{customer_name}}, {{customer_email_local}}, "
            f"or {{metadata.<key>}} for customer metadata."
        )

    if not _render_permissive(template):
        raise InvalidTemplateError(
            "Template renders to an empty channel name against a sample customer."
        )


def render_channel_name(
    template: str,
    context: TemplateContext,
    *,
    suffix: str | None = None,
    tolerant: bool = False,
) -> str:
    _validate_placeholder_syntax(template)
    rendered = _PLACEHOLDER_RE.sub(
        lambda match: _resolve(match.group(1), context, tolerant=tolerant),
        template,
    )
    if suffix:
        suffix_slug = slugify(suffix)
        if suffix_slug:
            if len(suffix_slug) >= _SLACK_CHANNEL_NAME_MAX_LENGTH:
                return suffix_slug[:_SLACK_CHANNEL_NAME_MAX_LENGTH]
            max_base_length = _SLACK_CHANNEL_NAME_MAX_LENGTH - len(suffix_slug) - 1
            rendered = slugify(rendered, max_length=max_base_length)
            if not rendered:
                return suffix_slug[:_SLACK_CHANNEL_NAME_MAX_LENGTH]
            return f"{rendered}-{suffix_slug}"[:_SLACK_CHANNEL_NAME_MAX_LENGTH]
    slug = slugify(rendered, max_length=_SLACK_CHANNEL_NAME_MAX_LENGTH)
    if not slug:
        raise InvalidTemplateError(
            "Template renders to an empty channel name for this customer."
        )
    return slug


def _resolve(name: str, context: TemplateContext, *, tolerant: bool) -> str:
    if name in _FIXED_PLACEHOLDERS:
        return str(getattr(context, name))
    if _METADATA_PLACEHOLDER_RE.fullmatch(name):
        key = name[len(_METADATA_PREFIX) :]
        value = context.metadata.get(key)
        if value is None:
            if tolerant:
                return key
            raise InvalidTemplateError(
                f"Customer is missing metadata key {key!r} required by the "
                f"channel name template."
            )
        return str(value)
    raise InvalidTemplateError(f"Unknown placeholder: {{{name}}}.")


def _render_permissive(template: str) -> str:
    sample = TemplateContext(
        customer_name="sample customer",
        customer_email_local="sample",
    )

    def sub(name: str) -> str:
        if name in _FIXED_PLACEHOLDERS:
            return str(getattr(sample, name))
        if _METADATA_PLACEHOLDER_RE.fullmatch(name):
            return "sample"
        return ""

    return slugify(_PLACEHOLDER_RE.sub(lambda match: sub(match.group(1)), template))


def _iter_placeholder_names(template: str) -> Iterator[str]:
    position = 0
    for match in _PLACEHOLDER_RE.finditer(template):
        _raise_for_malformed_braces(template[position : match.start()])
        name = match.group(1)
        if (
            _PLACEHOLDER_NAME_RE.fullmatch(name) is None
            and _METADATA_PLACEHOLDER_RE.fullmatch(name) is None
        ):
            raise _malformed_placeholder(f"{{{name}}}")
        yield name
        position = match.end()
    _raise_for_malformed_braces(template[position:])


def _validate_placeholder_syntax(template: str) -> None:
    for _ in _iter_placeholder_names(template):
        pass


def _raise_for_malformed_braces(value: str) -> None:
    if "{" in value or "}" in value:
        raise _malformed_placeholder(value)


def _malformed_placeholder(placeholder: str) -> InvalidTemplateError:
    return InvalidTemplateError(
        f"Malformed placeholder: {placeholder}. "
        f"Allowed: {{customer_name}}, {{customer_email_local}}, "
        f"or {{metadata.<key>}} for customer metadata."
    )
