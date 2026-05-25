import re
from dataclasses import dataclass, field
from typing import Any

from polar.kit.metadata import get_nested_metadata_value

_FIXED_PLACEHOLDERS = {"customer_name", "customer_email_local"}
_METADATA_PREFIX = "metadata."
_PLACEHOLDER_RE = re.compile(r"\{([\w.]+)\}")
_SLACK_CHANNEL_NAME_MAX_LENGTH = 80
_NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class TemplateContext:
    customer_name: str
    customer_email_local: str
    metadata: dict[str, Any] = field(default_factory=dict)


class InvalidTemplateError(ValueError):
    pass


def validate_template(template: str) -> None:
    """Raises InvalidTemplateError if the template references unknown
    placeholders or renders to an empty channel name against a sample customer.
    Metadata references are accepted unconditionally — missing keys are
    detected at grant time, not at template save time."""
    for match in _PLACEHOLDER_RE.finditer(template):
        name = match.group(1)
        if name in _FIXED_PLACEHOLDERS:
            continue
        if name.startswith(_METADATA_PREFIX) and len(name) > len(_METADATA_PREFIX):
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
    """Render `template` against `context`.

    When `tolerant=True`, missing `{metadata.X}` keys render as the key
    name itself instead of raising — useful for previewing how a template
    will look without a real customer.
    """
    rendered = _PLACEHOLDER_RE.sub(
        lambda m: _resolve(m.group(1), context, tolerant=tolerant), template
    )
    if suffix:
        rendered = f"{rendered}-{suffix}"
    return _slugify(rendered)[:_SLACK_CHANNEL_NAME_MAX_LENGTH]


def _resolve(name: str, context: TemplateContext, *, tolerant: bool) -> str:
    if name in _FIXED_PLACEHOLDERS:
        return str(getattr(context, name))
    if name.startswith(_METADATA_PREFIX):
        key = name[len(_METADATA_PREFIX) :]
        value = get_nested_metadata_value(context.metadata, key)
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
    """Like render_channel_name but substitutes a placeholder for any metadata
    reference. Used only by validate_template for the sample render."""
    sample = TemplateContext(
        customer_name="sample customer",
        customer_email_local="sample",
    )

    def sub(match: re.Match[str]) -> str:
        name = match.group(1)
        if name in _FIXED_PLACEHOLDERS:
            return str(getattr(sample, name))
        if name.startswith(_METADATA_PREFIX):
            return "sample"
        return ""

    return _slugify(_PLACEHOLDER_RE.sub(sub, template))


def _slugify(value: str) -> str:
    value = value.lower().strip()
    value = _NON_ALPHANUMERIC.sub("-", value)
    return value.strip("-")
