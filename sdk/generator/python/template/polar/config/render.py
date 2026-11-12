import json
import keyword
import typing

WIDTH = 88
INDENT = "    "

AGGREGATES = {
    "sum": "Sum",
    "max": "Max",
    "min": "Min",
    "avg": "Avg",
    "unique": "Unique",
}
OPERATORS = {"eq", "ne", "gt", "gte", "lt", "lte", "like", "not_like"}
METER_FIELDS = {
    "external_id",
    "name",
    "filter",
    "aggregation",
    "unit",
    "custom_label",
    "custom_multiplier",
    "metadata",
    "deprecated",
}

Scalar: typing.TypeAlias = str | int | float | bool


class Call(typing.NamedTuple):
    head: str
    arguments: list["Node"]


Node: typing.TypeAlias = str | Call


def render(document: dict[str, typing.Any]) -> str:
    """Write a config, as the Polar API exports it, as a Python config file.

    Raises:
        ValueError: A meter needs something `polar.config` cannot express yet.
    """
    imports = {"Config", "MeterSet"}
    meters = [_meter(meter, imports) for meter in document.get("meters") or []]
    if meters:
        imports.add("Meter")
    return "\n".join(
        [
            _import(imports),
            "",
            "",
            "class Meters(MeterSet):",
            *(meters or [f"{INDENT}pass"]),
            "",
            "",
            "config = Config(meters=Meters)",
            "",
        ]
    )


def _meter(exported: dict[str, typing.Any], imports: set[str]) -> str:
    meter = {key: value for key, value in exported.items() if value is not None}
    external_id = meter["external_id"]
    event, conditions = _event_and_conditions(meter["filter"])
    unsupported = (
        event is None or not _attribute(external_id) or meter.keys() - METER_FIELDS
    )
    if unsupported:
        raise ValueError(
            f"The meter {external_id} has an external ID, a filter or a field "
            "that Python cannot express yet."
        )
    unit = meter.get("unit", "scalar")
    metadata = ", ".join(
        f"{_literal(key)}: {_literal(value)}"
        for key, value in meter.get("metadata", {}).items()
    )
    options = {
        "aggregate": _aggregate(meter["aggregation"], imports),
        "unit": None if unit == "scalar" else _literal(unit),
        "custom_label": _optional_literal(meter.get("custom_label")),
        "custom_multiplier": _optional_literal(meter.get("custom_multiplier")),
        "metadata": "{" + metadata + "}" if metadata else None,
        "deprecated": "True" if meter.get("deprecated") else None,
    }
    arguments: list[Node] = [
        _literal(meter["name"]),
        f"on={_literal(event)}",
        *_where(conditions, imports),
        *(f"{name}={value}" for name, value in options.items() if value is not None),
    ]
    return _print(Call(f"{external_id} = Meter", arguments), INDENT)


def _attribute(external_id: str) -> bool:
    return (
        external_id.isascii()
        and external_id.isidentifier()
        and not keyword.iskeyword(external_id)
        and not external_id.startswith("__")
        and external_id != "_entries"
    )


def _event_and_conditions(
    filter: dict[str, typing.Any],
) -> tuple[str | None, list[dict[str, typing.Any]]]:
    first, *rest = filter["clauses"] or [{}]
    on_one_event = (
        filter["conjunction"] == "and"
        and first.get("property") == "name"
        and first.get("operator") == "eq"
        and isinstance(first.get("value"), str)
    )
    merged_by_meter = len(rest) == 1 and rest[0].get("conjunction") == "and"
    if not on_one_event or merged_by_meter:
        return None, []
    return first["value"], rest


def _where(conditions: list[dict[str, typing.Any]], imports: set[str]) -> list[Node]:
    if not conditions:
        return []
    where = (
        conditions[0]
        if len(conditions) == 1
        else {"conjunction": "and", "clauses": conditions}
    )
    return [_keyword("where", _condition(where, imports))]


def _condition(condition: dict[str, typing.Any], imports: set[str]) -> Node:
    if "conjunction" in condition:
        head = f"{condition['conjunction']}_"
        imports.add(head)
        return Call(
            head, [_condition(clause, imports) for clause in condition["clauses"]]
        )
    operator = condition["operator"]
    if operator not in OPERATORS:
        raise ValueError(f"Python cannot express the filter operator {operator} yet.")
    imports.add(operator)
    return (
        f"{operator}({_literal(condition['property'])}, {_literal(condition['value'])})"
    )


def _aggregate(aggregation: dict[str, typing.Any], imports: set[str]) -> str | None:
    if aggregation["func"] == "count":
        return None
    helper = AGGREGATES[aggregation["func"]]
    imports.add(helper)
    return f"{helper}({_literal(aggregation['property'])})"


def _optional_literal(value: Scalar | None) -> str | None:
    return None if value is None else _literal(value)


def _literal(value: Scalar) -> str:
    if not isinstance(value, str):
        return repr(value)
    quoted = json.dumps(value, ensure_ascii=False)
    if '"' in value and "'" not in value:
        return "'" + quoted[1:-1].replace('\\"', '"') + "'"
    return quoted


def _keyword(name: str, node: Node) -> Node:
    if isinstance(node, str):
        return f"{name}={node}"
    return node._replace(head=f"{name}={node.head}")


def _flat(node: Node) -> str:
    if isinstance(node, str):
        return node
    return f"{node.head}({', '.join(_flat(argument) for argument in node.arguments)})"


def _print(node: Node, indent: str, suffix: str = "") -> str:
    line = f"{indent}{_flat(node)}{suffix}"
    if isinstance(node, str) or len(line) <= WIDTH:
        return line
    return "\n".join(
        [
            f"{indent}{node.head}(",
            *(_print(argument, indent + INDENT, ",") for argument in node.arguments),
            f"{indent}){suffix}",
        ]
    )


def _import(names: set[str]) -> str:
    ordered = sorted(names, key=lambda name: (name[0].islower(), name.lower()))
    line = f"from polar.config import {', '.join(ordered)}"
    if len(line) <= WIDTH:
        return line
    return "\n".join(
        ["from polar.config import (", *(f"{INDENT}{name}," for name in ordered), ")"]
    )
