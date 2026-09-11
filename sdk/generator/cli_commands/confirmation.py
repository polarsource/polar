import collections.abc
import json
import typing

from generator.ir import (
    APIVersion,
    EnumRef,
    Field,
    LiteralType,
    NullableType,
    Parameter,
    PrimitiveType,
    TypeRef,
    UnionRef,
    UnionType,
)


class ConfirmationField(typing.TypedDict):
    key: str
    schema: str
    equals: str | bool | int | float | None


def confirmation_fields(
    fields: collections.abc.Sequence[Field | Parameter], api: APIVersion
) -> list[ConfirmationField]:
    conditions: list[ConfirmationField] = []

    for field in fields:
        if field.cli_confirm is None:
            continue

        expected = field.cli_confirm.equals
        schema, matches = _condition_schema(field.type, expected, api)
        if not matches:
            raise ValueError(
                f"CLI confirmation value for {field.name!r} does not match its schema"
            )

        conditions.append({"key": field.name, "schema": schema, "equals": expected})

    return conditions


def _condition_schema(
    type_ref: TypeRef, expected: str | bool | int | float | None, api: APIVersion
) -> tuple[str, bool]:
    if isinstance(type_ref, PrimitiveType):
        match type_ref.type:
            case "boolean":
                return "Schema.Boolean", type(expected) is bool
            case "string":
                return "Schema.String", isinstance(expected, str)
            case "integer":
                return "Schema.Int", type(expected) is int
            case "number":
                return "Schema.Finite", type(expected) in (int, float)

    if isinstance(type_ref, NullableType):
        schema, matches = _condition_schema(type_ref.inner, expected, api)
        return f"Schema.NullOr({schema})", expected is None or matches

    if isinstance(type_ref, LiteralType):
        schema = (
            "Schema.Null"
            if type_ref.value is None
            else f"Schema.Literal({json.dumps(type_ref.value)})"
        )
        matches = type(expected) is type(type_ref.value) and expected == type_ref.value
        return schema, matches

    if isinstance(type_ref, EnumRef):
        enum = next(enum for enum in api.enums if enum.name == type_ref.name)
        enum_variants: list[TypeRef] = [
            LiteralType(kind="literal", value=value.value) for value in enum.values
        ]
        return _condition_schema(
            UnionType(kind="union", variants=enum_variants), expected, api
        )

    if isinstance(type_ref, (UnionRef, UnionType)):
        union = (
            next(union for union in api.input_unions if union.name == type_ref.name)
            if isinstance(type_ref, UnionRef)
            else type_ref
        )
        variants = [
            _condition_schema(variant, expected, api) for variant in union.variants
        ]
        schemas = ", ".join(schema for schema, _ in variants)
        return f"Schema.Union([{schemas}])", any(matches for _, matches in variants)

    raise ValueError("CLI confirmation annotations require scalar input fields")
