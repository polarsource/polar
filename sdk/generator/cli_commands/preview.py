import typing

from generator.ir import (
    APIVersion,
    CLIPreviewField,
    EnumRef,
    Field,
    LiteralType,
    Method,
    ModelRef,
    NullableType,
    PrimitiveType,
    TypeRef,
    UnionRef,
    UnionType,
)


class PreviewOperation(typing.TypedDict):
    invoke: str
    fields: list[CLIPreviewField]


def preview_fields(method: Method, api: APIVersion) -> list[CLIPreviewField]:
    if method.cli_preview is None:
        return []
    fields = method.cli_preview.fields
    if not fields or len({field.key for field in fields}) != len(fields):
        raise ValueError(
            f"{method.operation_id}: preview fields must be nonempty and unique"
        )
    if method.response is None:
        raise ValueError(f"{method.operation_id}: preview requires a response schema")
    variants = _response_fields(method.response, api)
    for field in fields:
        for variant in variants:
            schema_field = variant.get(field.key)
            if schema_field is None:
                raise ValueError(
                    f"{method.operation_id}: preview field {field.key!r} must exist in every response variant"
                )
            if schema_field.write_only or not _is_scalar(schema_field.type, api):
                raise ValueError(
                    f"{method.operation_id}: preview field {field.key!r} must be a readable scalar"
                )
    return fields


def _response_fields(type_ref: TypeRef, api: APIVersion) -> list[dict[str, Field]]:
    if isinstance(type_ref, ModelRef):
        model = next(
            model for model in api.output_models if model.name == type_ref.name
        )
        return [{field.name: field for field in model.fields}]
    if isinstance(type_ref, (UnionRef, UnionType)):
        union = (
            next(union for union in api.output_unions if union.name == type_ref.name)
            if isinstance(type_ref, UnionRef)
            else type_ref
        )
        return [
            fields
            for variant in union.variants
            for fields in _response_fields(variant, api)
        ]
    raise ValueError("CLI previews require an object response or a union of objects")


def _is_scalar(type_ref: TypeRef, api: APIVersion) -> bool:
    if isinstance(type_ref, NullableType):
        return _is_scalar(type_ref.inner, api)
    if isinstance(type_ref, PrimitiveType):
        return type_ref.type != "unknown"
    if isinstance(type_ref, (EnumRef, LiteralType)):
        return True
    if isinstance(type_ref, (UnionRef, UnionType)):
        union = (
            next(union for union in api.output_unions if union.name == type_ref.name)
            if isinstance(type_ref, UnionRef)
            else type_ref
        )
        return all(_is_scalar(variant, api) for variant in union.variants)
    return False
