import pathlib

from generator.ir import (
    APIIR,
    APIVersion,
    EnumRef,
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


def test_emit_config_module_exporting_everything_the_config_reaches(
    tmp_path: pathlib.Path,
) -> None:
    config = Model(
        name="Config",
        fields=[
            Field(
                name="meters",
                type=ModelRef(kind="model", name="ConfigMeter"),
                required=False,
            )
        ],
    )
    meter = Model(
        name="ConfigMeter",
        fields=[
            Field(
                name="filter", type=ModelRef(kind="model", name="Filter"), required=True
            )
        ],
    )
    filter = Model(
        name="Filter",
        fields=[
            Field(
                name="conjunction",
                type=EnumRef(kind="enum", name="FilterConjunction"),
                required=True,
            )
        ],
    )
    unrelated = Model(name="ProductCreate", fields=[])
    api = APIVersion(
        version="2026-04",
        servers=[],
        services=[],
        input_models=[config, meter, filter, unrelated],
        output_models=[],
        webhooks=[],
        enums=[],
        input_unions=[],
        output_unions=[],
    )

    PythonEmitter(APIIR(versions=[api]), "2026-10").emit(tmp_path)

    module = (tmp_path / "polar" / "config" / "types.py").read_text()
    assert (
        "from polar.v2026_04.inputs import (\n    Config,\n    ConfigMeter,\n    Filter,\n)"
        in module
    )
    assert "from polar.v2026_04.literals import (\n    FilterConjunction,\n)" in module
    assert "ProductCreate" not in module
