import json
import pathlib

import openapi_pydantic as op

from generator.ir import (
    Field,
    LiteralType,
    Model,
    ModelRef,
    NamedUnion,
    NullableType,
    PrimitiveType,
    UnionDiscriminator,
    UnionRef,
    generate_ir,
)
from typescript.emitter import TypeScriptEmitter
from typescript.zod import ZodConverter, sort_unions_by_dependency

STRING = PrimitiveType(kind="primitive", type="string")


def _strip_pure(expression: str) -> str:
    return expression.replace("/* @__PURE__ */ ", "")


def test_convert_model_uses_getters_for_named_references() -> None:
    model = Model(
        name="Order",
        fields=[
            Field(name="id", type=STRING, required=True),
            Field(
                name="customer",
                type=NullableType(
                    kind="nullable", inner=ModelRef(kind="model", name="Customer")
                ),
                required=False,
            ),
        ],
    )

    assert _strip_pure(ZodConverter([], []).convert_model(model)) == (
        "z.looseObject({ id: z.string(), "
        "get customer() { return z.optional(z.nullable(Customer)); } })"
    )


def test_convert_model_with_additional_properties_defers_references() -> None:
    model = Model(
        name="EventMetadataInput",
        fields=[
            Field(name="id", type=STRING, required=True),
            Field(
                name="_llm",
                type=ModelRef(kind="model", name="LLMMetadata"),
                required=False,
            ),
        ],
        additional_properties=STRING,
    )

    assert _strip_pure(ZodConverter([], []).convert_model(model)) == (
        "z.catchall(z.object({ id: z.string(), "
        "_llm: z.optional(z.lazy(() => LLMMetadata)) }), z.string())"
    )


def _event_model(
    name: str, value: str, *, discriminator_required: bool = True
) -> Model:
    return Model(
        name=name,
        fields=[
            Field(
                name="name",
                type=LiteralType(kind="literal", value=value),
                required=discriminator_required,
            )
        ],
    )


def test_convert_named_union_nests_discriminated_unions() -> None:
    discriminator = UnionDiscriminator(property_name="name", mapping={})
    system_event = NamedUnion(
        name="SystemEvent",
        variants=[
            ModelRef(kind="model", name="OrderPaidEvent"),
            ModelRef(kind="model", name="OrderRefundedEvent"),
        ],
        discriminator=discriminator,
    )
    event = NamedUnion(
        name="Event",
        variants=[
            UnionRef(kind="union_ref", name="SystemEvent"),
            ModelRef(kind="model", name="UserEvent"),
        ],
        discriminator=discriminator,
    )
    models = [
        _event_model("OrderPaidEvent", "order.paid"),
        _event_model("OrderRefundedEvent", "order.refunded"),
        _event_model("UserEvent", "user.event"),
    ]

    converter = ZodConverter(models, [event, system_event])

    assert _strip_pure(converter.convert_named_union(event)) == (
        'z.discriminatedUnion("name", [SystemEvent, UserEvent])'
    )
    assert converter.is_discriminable_union(event)


def test_convert_named_union_with_optional_discriminator_uses_union() -> None:
    union = NamedUnion(
        name="DiscountCreate",
        variants=[
            ModelRef(kind="model", name="DiscountFixedCreate"),
            ModelRef(kind="model", name="DiscountPercentageCreate"),
        ],
        discriminator=UnionDiscriminator(property_name="name", mapping={}),
    )
    models = [
        _event_model("DiscountFixedCreate", "fixed", discriminator_required=False),
        _event_model("DiscountPercentageCreate", "percentage"),
    ]

    converter = ZodConverter(models, [union])

    assert _strip_pure(converter.convert_named_union(union)) == (
        "z.union([DiscountFixedCreate, DiscountPercentageCreate])"
    )
    assert not converter.is_discriminable_union(union)


def test_convert_empty_model_keeps_unknown_fields() -> None:
    model = Model(name="BenefitFeatureFlagProperties", fields=[])

    assert _strip_pure(ZodConverter([], []).convert_model(model)) == (
        "z.looseObject({}) as never"
    )


def test_sort_unions_by_dependency_declares_referenced_unions_first() -> None:
    outer = NamedUnion(
        name="A", variants=[UnionRef(kind="union_ref", name="B"), STRING]
    )
    inner = NamedUnion(name="B", variants=[STRING, ModelRef(kind="model", name="M")])

    assert [u.name for u in sort_unions_by_dependency([outer, inner])] == ["B", "A"]


def test_emits_zod_entry_point(
    code_samples_spec: op.OpenAPI, tmp_path: pathlib.Path
) -> None:
    TypeScriptEmitter(generate_ir(code_samples_spec), "1.2.3").emit(tmp_path)

    manifest = json.loads((tmp_path / "package.json").read_text())
    assert manifest["peerDependencies"]["zod"] == "^3.25.65 || ^4.0.0"
    assert manifest["peerDependenciesMeta"]["zod"]["optional"] is True
    assert manifest["exports"]["./2026-04/zod"]["import"]["default"] == (
        "./dist/2026-04/zod.mjs"
    )
    source = (tmp_path / "src" / "2026-04" / "zod.ts").read_text()
    assert 'import * as z from "zod/v4-mini";' in source
    assert "export const WebhookPayload" in source
