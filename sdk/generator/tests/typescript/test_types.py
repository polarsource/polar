from generator.ir import Field, Model, ModelRef, PrimitiveType, UnionType
from typescript.types import (
    convert_additional_properties_to_typescript,
    convert_type_to_typescript,
)


def test_convert_type_to_typescript_deduplicates_union_members() -> None:
    type_ref = UnionType(
        kind="union",
        variants=[
            PrimitiveType(kind="primitive", type="integer"),
            PrimitiveType(kind="primitive", type="number"),
        ],
    )

    assert convert_type_to_typescript(type_ref) == "number"


def test_convert_additional_properties_to_typescript_includes_field_types() -> None:
    model = Model(
        name="EventMetadataInput",
        fields=[
            Field(
                name="_cost",
                type=ModelRef(kind="model", name="CostMetadataInput"),
                required=False,
            ),
            Field(
                name="_llm",
                type=ModelRef(kind="model", name="LLMMetadata"),
                required=False,
            ),
        ],
        additional_properties=UnionType(
            kind="union",
            variants=[
                PrimitiveType(kind="primitive", type="string"),
                PrimitiveType(kind="primitive", type="integer"),
                PrimitiveType(kind="primitive", type="number"),
                PrimitiveType(kind="primitive", type="boolean"),
            ],
        ),
    )

    assert convert_additional_properties_to_typescript(model) == (
        "string | number | boolean | CostMetadataInput | LLMMetadata | undefined"
    )
