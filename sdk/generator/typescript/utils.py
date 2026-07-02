import typing


def format_default_value_ts(default: typing.Any) -> str:
    """Format a default value for TypeScript code generation."""
    if default is None:
        return "null"
    if isinstance(default, str):
        return repr(default)
    if isinstance(default, bool):
        return "true" if default else "false"
    if isinstance(default, (int, float)):
        return str(default)
    if isinstance(default, list):
        if len(default) == 0:
            return "[]"
        items = ", ".join(format_default_value_ts(item) for item in default)
        return f"[{items}]"
    if isinstance(default, dict):
        if len(default) == 0:
            return "{}"
        items = ", ".join(
            f"{repr(k)}: {format_default_value_ts(v)}" for k, v in default.items()
        )
        return f"{{{items}}}"
    return repr(default)


def format_description(description: str) -> str:
    """Format a description string for JSDoc comments in TypeScript code generation."""
    if not description:
        return ""
    lines = description.splitlines()
    formatted_lines = ["* " + line for line in lines]
    return "\n".join(formatted_lines)
