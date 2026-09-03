import pathlib

from generator.ir import (
    APIIR,
    APIVersion,
    Field,
    Model,
    ModelRef,
    PrimitiveType,
    UnionType,
)
from python.emitter import PythonEmitter


def test_emit_input_model_with_fields_and_additional_properties(
    tmp_path: pathlib.Path,
) -> None:
    model = Model(
        name="EventMetadataInput",
        fields=[
            Field(
                name="_cost",
                type=ModelRef(kind="model", name="CostMetadataInput"),
                required=False,
            )
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
    api = APIVersion(
        version="2026-04",
        servers=[],
        services=[],
        input_models=[model],
        output_models=[],
        webhooks=[],
        enums=[],
        input_unions=[],
        output_unions=[],
    )

    PythonEmitter(APIIR(versions=[api]), "1.0.0").emit(tmp_path)

    inputs = (tmp_path / "polar" / "v2026_04" / "inputs.py").read_text()
    assert "import typing_extensions" in inputs
    assert (
        "class EventMetadataInput(typing_extensions.TypedDict, "
        "extra_items=str | int | float | bool):"
    ) in inputs
