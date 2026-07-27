import typing as _typing


def format_default_value(default: _typing.Any) -> str:
    """Format a default value for Python code generation."""

    if default is None:
        return "None"
    if isinstance(default, str):
        return repr(default)
    if isinstance(default, bool):
        return str(default)
    if isinstance(default, (int, float)):
        return str(default)
    if isinstance(default, list):
        if len(default) == 0:
            return "[]"
        return f"[{', '.join(format_default_value(item) for item in default)}]"
    if isinstance(default, dict):
        if len(default) == 0:
            return "{}"
        return (
            "{"
            + ", ".join(
                f"{repr(k)}: {format_default_value(v)}" for k, v in default.items()
            )
            + "}"
        )
    return repr(default)


def format_default_value_dataclass(default: _typing.Any) -> str:
    """Format a default value for Python dataclass code generation."""

    if isinstance(default, list):
        if len(default) == 0:
            return "dataclasses.field(default_factory=list)"
        return f"dataclasses.field(default_factory=lambda: [{', '.join(format_default_value_dataclass(item) for item in default)}])"
    if isinstance(default, dict):
        if len(default) == 0:
            return "dataclasses.field(default_factory=dict)"
        return (
            "dataclasses.field(default_factory=lambda: {"
            + ", ".join(
                f"{repr(k)}: {format_default_value_dataclass(v)}"
                for k, v in default.items()
            )
            + "})"
        )

    return format_default_value(default)
