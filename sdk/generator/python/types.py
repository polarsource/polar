from generator.ir import (
    ArrayType,
    EnumRef,
    LiteralType,
    MapType,
    ModelRef,
    NullableType,
    PrimitiveType,
    TypeRef,
    UnionRef,
    UnionType,
)


def _convert_primitive_type(primitive: PrimitiveType) -> str:
    type_map = {
        "string": "str",
        "integer": "int",
        "number": "float",
        "boolean": "bool",
        "unknown": "typing.Any",
    }
    return type_map.get(primitive.type, "typing.Any")


def _convert_literal_type(literal: LiteralType) -> str:
    if literal.value is None:
        return "None"
    if isinstance(literal.value, str):
        return f"typing.Literal[{literal.value!r}]"
    return f"typing.Literal[{literal.value}]"


def _collect_enum_imports(type_ref: TypeRef, enum_imports: set[str]) -> None:
    if isinstance(type_ref, EnumRef):
        enum_imports.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        _collect_enum_imports(type_ref.inner, enum_imports)
    elif isinstance(type_ref, ArrayType):
        _collect_enum_imports(type_ref.items, enum_imports)
    elif isinstance(type_ref, MapType):
        _collect_enum_imports(type_ref.value_type, enum_imports)
        if type_ref.key_type is not None:
            _collect_enum_imports(type_ref.key_type, enum_imports)
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            _collect_enum_imports(variant, enum_imports)


def collect_model_enum_imports(
    _model_name: str, type_ref: TypeRef, enum_imports: set[str] | None = None
) -> set[str]:
    if enum_imports is None:
        enum_imports = set()
    _collect_enum_imports(type_ref, enum_imports)
    return enum_imports


def convert_type_to_annotation(
    type_ref: TypeRef | None, *, ref_suffix: str = ""
) -> str:
    if isinstance(type_ref, PrimitiveType):
        return _convert_primitive_type(type_ref)

    if isinstance(type_ref, LiteralType):
        return _convert_literal_type(type_ref)

    if isinstance(type_ref, EnumRef):
        return f"{type_ref.name}{ref_suffix}"

    if isinstance(type_ref, ModelRef):
        return f"{type_ref.name}{ref_suffix}"

    if isinstance(type_ref, UnionRef):
        return f"{type_ref.name}{ref_suffix}"

    if isinstance(type_ref, NullableType):
        inner = convert_type_to_annotation(type_ref.inner, ref_suffix=ref_suffix)
        return f"{inner} | None"

    if isinstance(type_ref, ArrayType):
        items = convert_type_to_annotation(type_ref.items, ref_suffix=ref_suffix)
        return f"typing.List[{items}]"

    if isinstance(type_ref, MapType):
        value_type = convert_type_to_annotation(
            type_ref.value_type, ref_suffix=ref_suffix
        )
        if type_ref.key_type is not None:
            key_type = convert_type_to_annotation(
                type_ref.key_type, ref_suffix=ref_suffix
            )
            return f"dict[{key_type}, {value_type}]"
        return f"dict[str, {value_type}]"

    if isinstance(type_ref, UnionType):
        if len(type_ref.variants) == 0:
            return "typing.Any"
        variant_strs = [
            convert_type_to_annotation(v, ref_suffix=ref_suffix)
            for v in type_ref.variants
        ]
        return " | ".join(variant_strs)

    return "None"


def wrap_nullable_type(type_ref: TypeRef) -> NullableType:
    """Wrap a TypeRef in a NullableType if it is not already nullable."""
    if isinstance(type_ref, NullableType):
        return type_ref
    return NullableType(kind="nullable", inner=type_ref)
