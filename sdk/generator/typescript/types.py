from generator.ir import (
    ArrayType,
    EnumRef,
    LiteralType,
    MapType,
    ModelRef,
    NullableType,
    OpenAPIIR,
    PrimitiveType,
    TypeRef,
    UnionRef,
    UnionType,
)


def convert_type_to_typescript(
    type_ref: TypeRef,
    ir: OpenAPIIR,
    ref_suffix: str = "",
    in_union: bool = False,
) -> str:
    """Convert IR TypeRef to TypeScript type annotation."""

    # Handle nullability - wrap in parentheses if in a union
    if isinstance(type_ref, NullableType):
        inner = convert_type_to_typescript(
            type_ref.inner, ir, ref_suffix, in_union=True
        )
        if in_union:
            return f"({inner} | null)"
        return f"{inner} | null"

    # PrimitiveType -> string, number, boolean, unknown
    if isinstance(type_ref, PrimitiveType):
        type_map = {
            "string": "string",
            "integer": "number",
            "number": "number",
            "boolean": "boolean",
            "unknown": "unknown",
        }
        return type_map.get(type_ref.type, "unknown")

    # LiteralType -> literal value
    if isinstance(type_ref, LiteralType):
        if type_ref.value is None:
            return "null"
        if type_ref.value is True:
            return "true"
        if type_ref.value is False:
            return "false"
        if isinstance(type_ref.value, str):
            return f'"{type_ref.value}"'
        return str(type_ref.value)

    # EnumRef -> enum name
    if isinstance(type_ref, EnumRef):
        return f"{type_ref.name}{ref_suffix}"

    # ModelRef -> ModelName
    if isinstance(type_ref, ModelRef):
        return f"{type_ref.name}{ref_suffix}"

    # UnionRef -> reference to named union type
    if isinstance(type_ref, UnionRef):
        return f"{type_ref.name}{ref_suffix}"

    # UnionType -> inline union (| syntax)
    if isinstance(type_ref, UnionType):
        if len(type_ref.variants) == 0:
            return "unknown"
        variant_strs = [
            convert_type_to_typescript(v, ir, ref_suffix, in_union=True)
            for v in type_ref.variants
        ]
        # Join with |, wrapping nullable types in parens if needed
        return " | ".join(variant_strs)

    # ArrayType -> Type[]
    if isinstance(type_ref, ArrayType):
        items = convert_type_to_typescript(
            type_ref.items, ir, ref_suffix, in_union=True
        )
        return f"{items}[]"

    # MapType -> Record<KeyType, ValueType>
    if isinstance(type_ref, MapType):
        value_type = convert_type_to_typescript(
            type_ref.value_type, ir, ref_suffix, in_union=True
        )
        if type_ref.key_type is not None:
            key_type = convert_type_to_typescript(
                type_ref.key_type, ir, ref_suffix, in_union=True
            )
            return f"Record<{key_type}, {value_type}>"
        return f"Record<string, {value_type}>"

    return "unknown"


def collect_type_imports(type_ref: TypeRef | None, ir: OpenAPIIR) -> set[str]:
    """Collect all model, enum, and union names from a TypeRef."""
    if type_ref is None:
        return set()

    names: set[str] = set()

    if isinstance(type_ref, (ModelRef, EnumRef, UnionRef)):
        names.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        names.update(collect_type_imports(type_ref.inner, ir))
    elif isinstance(type_ref, ArrayType):
        names.update(collect_type_imports(type_ref.items, ir))
    elif isinstance(type_ref, MapType):
        names.update(collect_type_imports(type_ref.value_type, ir))
        if type_ref.key_type is not None:
            names.update(collect_type_imports(type_ref.key_type, ir))
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            names.update(collect_type_imports(variant, ir))

    return names


def collect_enum_imports(
    type_ref: TypeRef | None, enum_imports: set[str], ir: OpenAPIIR
) -> None:
    """Collect all enum names from a TypeRef."""
    if type_ref is None:
        return

    if isinstance(type_ref, EnumRef):
        enum_imports.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        collect_enum_imports(type_ref.inner, enum_imports, ir)
    elif isinstance(type_ref, ArrayType):
        collect_enum_imports(type_ref.items, enum_imports, ir)
    elif isinstance(type_ref, MapType):
        collect_enum_imports(type_ref.value_type, enum_imports, ir)
        if type_ref.key_type is not None:
            collect_enum_imports(type_ref.key_type, enum_imports, ir)
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            collect_enum_imports(variant, enum_imports, ir)
    elif isinstance(type_ref, UnionRef):
        for union in ir.input_unions + ir.output_unions:
            if union.name == type_ref.name:
                for variant in union.variants:
                    collect_enum_imports(variant, enum_imports, ir)
                break


def collect_union_imports(type_ref: TypeRef | None, ir: OpenAPIIR) -> set[str]:
    """Collect all union type imports from a TypeRef."""
    if type_ref is None:
        return set()

    names: set[str] = set()

    if isinstance(type_ref, UnionRef):
        names.add(type_ref.name)
    elif isinstance(type_ref, NullableType):
        names.update(collect_union_imports(type_ref.inner, ir))
    elif isinstance(type_ref, ArrayType):
        names.update(collect_union_imports(type_ref.items, ir))
    elif isinstance(type_ref, MapType):
        names.update(collect_union_imports(type_ref.value_type, ir))
        if type_ref.key_type is not None:
            names.update(collect_union_imports(type_ref.key_type, ir))
    elif isinstance(type_ref, UnionType):
        for variant in type_ref.variants:
            names.update(collect_union_imports(variant, ir))

    return names
