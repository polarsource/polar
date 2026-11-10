import graphlib
import json

from generator.ir import (
    ArrayType,
    Enum,
    EnumRef,
    LiteralType,
    MapType,
    Model,
    ModelRef,
    NamedUnion,
    NullableType,
    PrimitiveType,
    TypeRef,
    UnionDiscriminator,
    UnionRef,
    UnionType,
)

PURE = "/* @__PURE__ */ "

PRIMITIVE_SCHEMAS = {
    "string": "z.string()",
    "integer": "z.int()",
    "number": "z.number()",
    "boolean": "z.boolean()",
    "unknown": "z.unknown()",
}


class ZodConverter:
    def __init__(self, models: list[Model], unions: list[NamedUnion]) -> None:
        self._models = {model.name: model for model in models}
        self._discriminable_unions: set[str] = set()
        for union in sort_unions_by_dependency(unions):
            if union.discriminator is not None and self._has_required_discriminator(
                union.variants, union.discriminator
            ):
                self._discriminable_unions.add(union.name)

    def convert_type(self, type_ref: TypeRef) -> str:
        if isinstance(type_ref, NullableType):
            return self._call("nullable", self.convert_type(type_ref.inner))
        if isinstance(type_ref, PrimitiveType):
            return PURE + PRIMITIVE_SCHEMAS[type_ref.type]
        if isinstance(type_ref, LiteralType):
            if type_ref.value is None:
                return self._call("null")
            return self._call("literal", json.dumps(type_ref.value))
        if isinstance(type_ref, (EnumRef, ModelRef, UnionRef)):
            return type_ref.name
        if isinstance(type_ref, UnionType):
            return self._convert_union(type_ref.variants, type_ref.discriminator)
        if isinstance(type_ref, ArrayType):
            return self._call("array", self.convert_type(type_ref.items))
        if isinstance(type_ref, MapType):
            return self._call(
                "record", PURE + "z.string()", self.convert_type(type_ref.value_type)
            )
        return PURE + "z.unknown()"

    def convert_enum(self, enum: Enum) -> str:
        values = ", ".join(json.dumps(value.value) for value in enum.values)
        return self._call("enum", f"[{values}]")

    def convert_model(self, model: Model) -> str:
        if not model.fields:
            if model.additional_properties is None:
                # The SDK types these models as Record<string, never>, which a
                # loose object's output doesn't satisfy.
                return f"{self._call('looseObject', '{}')} as never"
            return self._call(
                "record",
                PURE + "z.string()",
                self._convert_deferred(model.additional_properties),
            )

        if model.additional_properties is None:
            return self._call("looseObject", self._convert_shape(model, lazy=False))

        return self._call(
            "catchall",
            self._call("object", self._convert_shape(model, lazy=True)),
            self._convert_deferred(model.additional_properties),
        )

    def convert_named_union(self, union: NamedUnion) -> str:
        return self._convert_union(union.variants, union.discriminator)

    def is_discriminable_union(self, union: NamedUnion) -> bool:
        return union.name in self._discriminable_unions

    def is_discriminable_model(self, model: Model) -> bool:
        return bool(model.fields) or model.additional_properties is None

    def _convert_shape(self, model: Model, *, lazy: bool) -> str:
        properties: list[str] = []
        for field in model.fields:
            if lazy or not references_named_schema(field.type):
                expression = self._convert_deferred(field.type)
                if not field.required:
                    expression = self._call("optional", expression)
                properties.append(f"{field.name}: {expression}")
                continue
            expression = self.convert_type(field.type)
            if not field.required:
                expression = self._call("optional", expression)
            properties.append(f"get {field.name}() {{ return {expression}; }}")
        return "{ " + ", ".join(properties) + " }"

    def _convert_deferred(self, type_ref: TypeRef) -> str:
        """Defer references to other schemas when Zod reads the shape eagerly."""
        expression = self.convert_type(type_ref)
        if references_named_schema(type_ref):
            return self._call("lazy", f"() => {expression}")
        return expression

    def _convert_union(
        self, variants: list[TypeRef], discriminator: UnionDiscriminator | None
    ) -> str:
        expressions = list(dict.fromkeys(self.convert_type(v) for v in variants))
        if not expressions:
            return PURE + "z.unknown()"
        if len(expressions) == 1:
            return expressions[0]
        options = f"[{', '.join(expressions)}]"
        if discriminator is not None and self._has_required_discriminator(
            variants, discriminator
        ):
            return self._call(
                "discriminatedUnion",
                json.dumps(discriminator.property_name),
                options,
            )
        return self._call("union", options)

    def _has_required_discriminator(
        self, variants: list[TypeRef], discriminator: UnionDiscriminator
    ) -> bool:
        """Zod rejects discriminated unions whose variants may omit the key."""
        return all(
            self._requires_discriminator(variant, discriminator.property_name)
            for variant in variants
        )

    def _requires_discriminator(self, variant: TypeRef, property_name: str) -> bool:
        if isinstance(variant, UnionRef):
            return variant.name in self._discriminable_unions
        if not isinstance(variant, ModelRef) or variant.name not in self._models:
            return False
        return any(
            field.name == property_name and field.required
            for field in self._models[variant.name].fields
        )

    def _call(self, function: str, *arguments: str) -> str:
        return f"{PURE}z.{function}({', '.join(arguments)})"


def references_named_schema(type_ref: TypeRef) -> bool:
    if isinstance(type_ref, (ModelRef, UnionRef)):
        return True
    if isinstance(type_ref, NullableType):
        return references_named_schema(type_ref.inner)
    if isinstance(type_ref, ArrayType):
        return references_named_schema(type_ref.items)
    if isinstance(type_ref, MapType):
        return references_named_schema(type_ref.value_type)
    if isinstance(type_ref, UnionType):
        return any(references_named_schema(v) for v in type_ref.variants)
    return False


def sort_unions_by_dependency(unions: list[NamedUnion]) -> list[NamedUnion]:
    """Order unions so that a union is declared after the unions it references."""
    by_name = {union.name: union for union in unions}
    graph = {
        union.name: {
            name for name in _referenced_union_names(union.variants) if name in by_name
        }
        for union in unions
    }
    return [by_name[name] for name in graphlib.TopologicalSorter(graph).static_order()]


def _referenced_union_names(variants: list[TypeRef]) -> set[str]:
    names: set[str] = set()
    for variant in variants:
        if isinstance(variant, UnionRef):
            names.add(variant.name)
        elif isinstance(variant, NullableType):
            names.update(_referenced_union_names([variant.inner]))
        elif isinstance(variant, ArrayType):
            names.update(_referenced_union_names([variant.items]))
        elif isinstance(variant, MapType):
            names.update(_referenced_union_names([variant.value_type]))
        elif isinstance(variant, UnionType):
            names.update(_referenced_union_names(variant.variants))
    return names
