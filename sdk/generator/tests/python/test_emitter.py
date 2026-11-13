import pathlib

import pytest

from generator.ir import (
    APIIR,
    APIVersion,
    Enum,
    EnumRef,
    EnumValue,
    Field,
    LiteralType,
    Model,
    ModelRef,
    NamedUnion,
    PrimitiveType,
    UnionDiscriminator,
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

    PythonEmitter(APIIR(versions=[api]), "2026-10").emit(tmp_path)

    for module in ("events", "client", "buffered", "meter", "errors"):
        assert (tmp_path / "polar" / "metering" / f"{module}.py").is_file()
    assert not (tmp_path / "polar" / "metering" / "alias.py").exists()
    for module in ("conftest", "test_buffered", "test_metering"):
        assert (tmp_path / "tests" / "metering" / f"{module}.py").is_file()
    metering_tests = (tmp_path / "tests" / "metering" / "test_metering.py").read_text()
    assert "from polar.v2026_04 import PolarAsync" in metering_tests
    assert "from polar.v2026_10 import PolarAsync" not in metering_tests
    assert (tmp_path / "polar" / "outpost" / "reducer.py").is_file()
    assert (tmp_path / "polar" / "outpost" / "client.py").is_file()
    for module in ("client", "event", "reducer"):
        assert (tmp_path / "tests" / "outpost" / f"test_{module}.py").is_file()

    inputs = (tmp_path / "polar" / "v2026_04" / "inputs.py").read_text()
    assert "import typing_extensions" in inputs
    assert (
        "class EventMetadataInput(typing_extensions.TypedDict, "
        "extra_items=str | int | float | bool):"
    ) in inputs


def test_emit_output_model_with_fields_and_additional_properties(
    tmp_path: pathlib.Path,
) -> None:
    model = Model(
        name="EventMetadataOutput",
        fields=[
            Field(
                name="_cost",
                type=ModelRef(kind="model", name="CostMetadataOutput"),
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
        input_models=[],
        output_models=[model],
        webhooks=[],
        enums=[],
        input_unions=[],
        output_unions=[],
    )

    PythonEmitter(APIIR(versions=[api]), "2026-10").emit(tmp_path)

    outputs = (tmp_path / "polar" / "v2026_04" / "outputs.py").read_text()
    assert "import typing_extensions" in outputs
    assert "from polar.base import _register_extra_items_typed_dict" in outputs
    assert (
        "class EventMetadataOutput(\n"
        "    typing_extensions.TypedDict,\n"
        "    extra_items=str | int | float | bool,\n"
        "):"
    ) in outputs
    assert "_cost: typing.NotRequired[CostMetadataOutput]" in outputs
    assert (
        "_register_extra_items_typed_dict(\n"
        "    EventMetadataOutput,\n"
        "    str | int | float | bool,\n"
        ")"
    ) in outputs


@pytest.mark.parametrize("inline", [False, True])
def test_emit_open_string_enums_for_responses(
    tmp_path: pathlib.Path, inline: bool
) -> None:
    status = EnumRef(kind="enum", name="OrderStatus")
    variants = [ModelRef(kind="model", name="Order")]
    discriminator = UnionDiscriminator(property_name="kind", mapping={})
    model = Model(
        name="Order",
        fields=[
            Field(name="status", type=status, required=True),
            Field(
                name="kind",
                type=EnumRef(kind="enum", name="OrderKind"),
                required=True,
            ),
            Field(
                name="type",
                type=LiteralType(kind="literal", value="order"),
                required=True,
            ),
        ],
    )
    api = APIVersion(
        version="2026-04",
        servers=[],
        services=[],
        input_models=[model],
        output_models=[
            model,
            *(
                [
                    Model(
                        name="Envelope",
                        fields=[
                            Field(
                                name="event",
                                type=UnionType(
                                    kind="union",
                                    variants=variants,
                                    discriminator=discriminator,
                                ),
                                required=True,
                            )
                        ],
                    )
                ]
                if inline
                else []
            ),
        ],
        webhooks=[],
        enums=[
            Enum(
                name="OrderStatus",
                type="string",
                values=[EnumValue(name="PAID", value="paid")],
            ),
            Enum(
                name="OrderKind",
                type="string",
                values=[EnumValue(name="ORDER", value="order")],
            ),
        ],
        input_unions=[],
        output_unions=[]
        if inline
        else [
            NamedUnion(
                name="OrderEvent",
                variants=variants,
                discriminator=discriminator,
            ),
        ],
    )

    PythonEmitter(APIIR(versions=[api]), "1.1.0").emit(tmp_path)

    version = tmp_path / "polar" / "v2026_04"
    literals = (version / "literals.py").read_text()
    assert (
        "OrderStatus: typing.TypeAlias = typing.Annotated[typing.Literal[" in literals
    )
    assert "OrderKind: typing.TypeAlias = typing.Literal[" in literals
    assert ", _OPEN_ENUM]" in literals
    assert "status: OrderStatus" in (version / "inputs.py").read_text()
    outputs = (version / "outputs.py").read_text()
    assert "status: OrderStatus" in outputs
    assert "kind: OrderKind" in outputs
    assert "type: typing.Literal['order']" in outputs
