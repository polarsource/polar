from pydantic.json_schema import models_json_schema

from polar.declarative_config.schemas import Config, ConfigExport


def test_export_schema_is_not_split() -> None:
    _, definitions = models_json_schema(
        [(Config, "validation"), (ConfigExport, "serialization")],
        ref_template="#/components/schemas/{model}",
    )
    split = [
        name
        for name in definitions["$defs"]
        if name.startswith("Config") and name.endswith(("-Input", "-Output"))
    ]
    assert split == []
